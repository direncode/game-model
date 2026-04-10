"""Build a cross-era corpus of surface-wave / wireless power transmission documents.

The experimental hypothesis: BTUT's medium-resolution lattice signature that flagged
US1119732 as anomalous should also appear in modern Zenneck-wave patents, because
they all share the same core engineering distinction (non-radiative surface wave
coupling vs. ordinary electromagnetic radiation).

This script builds the corpus, extracts structural features that proxy BTUT's
lattice signature (vocabulary distribution, claim structure, numerical density,
cross-reference patterns), and runs feature-based clustering to check whether
Tesla's 1900s patents cluster with modern surface-wave work.

Feature vector per document:
- Claim count and claim-level vocabulary concentration
- Numerical value density (counts per 1000 words)
- Structural keyword density: ["resonance", "quarter wave", "ground", "elevated",
  "radiation", "conduction", "surface wave", "Zenneck", "standing wave", etc.]
- Distinction-statement markers: phrases that contrast two propagation modes
- Cross-reference density (patent citations)
- Technical-specification density (microfarads, kilohertz, turns, etc.)
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


CORPUS_DIR = Path(__file__).parent / "documents"
OUTPUT_DIR = Path(__file__).parent / "output"


# --- Feature extraction ---

# Vocabulary grouped by physics regime — designed to discriminate:
#   (1) Bound surface wave along lossy medium interface
#   (2) Near-field inductive resonant coupling (non-radiative but different physics)
#   (3) Free-space electromagnetic radiation
SURFACE_WAVE_KEYWORDS = {
    # --- SPECIFIC TO SURFACE WAVE PHYSICS ---
    "sw_surface_wave": [
        "surface wave",
        "guided surface wave",
        "zenneck",
        "bound to the interface",
        "bound wave",
        "guided wave",
        "sommerfeld",
        "brewster angle",
        "lossy conducting medium",
        "lossy medium",
        "wave tilt",
    ],
    "sw_earth_interface": [
        "through the earth",
        "through the natural medi",
        "earth-air interface",
        "earth surface",
        "conducting interface",
        "interface between",
        "terrestrial medium",
        "air strata",
        "atmosphere as a conduct",
        "conducting medium",
    ],
    "sw_ground_elevated": [
        "ground",
        "grounded",
        "earth",
        "elevated terminal",
        "elevated conductor",
        "elevated antenna",
        "charge terminal",
        "vertical axis",
    ],
    "sw_slow_wave": [
        "slow wave",
        "slow-wave",
        "velocity factor",
        "helical",
        "helix",
        "phase velocity",
        "propagation constant",
        "effective height",
    ],
    # --- SPECIFIC TO INDUCTIVE RESONANT COUPLING ---
    "ind_near_field": [
        "near-field",
        "near field",
        "evanescent",
        "evanescent field",
        "evanescent tail",
        "characteristic size",
        "mid-range",
        "radiation caustic",
    ],
    "ind_coupled_resonator": [
        "coupled resonator",
        "coupled electromagnetic",
        "source resonator",
        "device resonator",
        "dielectric disk",
        "whispering gallery",
        "quality factor",
        "high-q",
        "coupling coefficient",
        "strong-coupling",
    ],
    "ind_magnetic": [
        "magnetic field",
        "magnetic resonator",
        "magnetic near-field",
        "inductive coupling",
        "mutual inductance",
        "oscillating magnetic",
    ],
    # --- SPECIFIC TO RADIATIVE PROPAGATION ---
    "rad_radiation": [
        "electromagnetic radiation",
        "electrical radiation",
        "radiated",
        "radiate",
        "radiating",
        "radiation pattern",
        "far field",
        "far-field",
        "free space propagation",
        "free-space",
        "hertzian",
        "hertzian wave",
        "inverse square",
        "unguided",
        "free or unguided",
        "free wave",
        "free electromagnetic",
        "broadcast",
        "broadcasting",
        "propagating outward",
        "spreads out in space",
        "in all directions",
    ],
    "rad_antenna": [
        "dipole antenna",
        "half-wave dipole",
        "antenna gain",
        "radiation pattern",
        "beam",
        "omnidirectional",
    ],
    # --- NON-SPECIFIC (shared by multiple regimes) ---
    "shared_non_radiative": [
        "non-radiative",
        "non radiative",
        "non-radiating",
        "not radiation",
        "not to be confounded",
        "true conduction",
    ],
    "shared_resonance": [
        "resonance",
        "resonant",
        "resonating",
        "quarter wave",
        "quarter-wave",
        "quarter wavelength",
        "one-quarter of the wave",
        "standing wave",
        "stationary wave",
    ],
    "shared_quarter_period": [
        "one quarter of the period",
        "quarter of the period",
        "quarter period",
        "period of vibration",
        "free oscillation",
        "natural oscillation",
    ],
}


NUMBER_PATTERN = re.compile(
    r"""
    (?:\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)  # 1,000 or 1,000,000.5
    | (?:\b\d+(?:\.\d+)?\b)                # 123 or 123.45
    """,
    re.VERBOSE,
)

UNIT_PATTERN = re.compile(
    r"""
    \b(?:
      hz | khz | mhz | ghz
      | hertz | kilohertz | megahertz
      | volt | volts | kilovolts | kv | mv
      | ampere | amperes | amps
      | ohm | ohms
      | farad | microfarad | μf | uf | nf | pf
      | henry | millihenry | microhenry | μh | uh | mh
      | meter | meters | feet | foot | mile | miles | inch | inches | cm | mm
      | second | seconds | per\s+second
      | horse[- ]?power | hp | kw | mw | watts
    )\b
    """,
    re.VERBOSE | re.IGNORECASE,
)

CLAIM_START_PATTERN = re.compile(
    r"^\s*(?:What I (?:now )?claim is|Having described my invention,?\s+I claim)",
    re.MULTILINE | re.IGNORECASE,
)


def extract_features(text: str, metadata: dict[str, Any]) -> dict[str, Any]:
    """Extract a feature vector from a single document."""
    text_lower = text.lower()
    word_count = max(len(text.split()), 1)

    # Keyword density (count per 1000 words)
    keyword_features = {}
    for group_name, keywords in SURFACE_WAVE_KEYWORDS.items():
        count = 0
        for kw in keywords:
            count += text_lower.count(kw.lower())
        keyword_features[f"kw_{group_name}"] = round(count / word_count * 1000, 3)

    # Numerical value density
    numbers = NUMBER_PATTERN.findall(text)
    number_density = round(len(numbers) / word_count * 1000, 3)

    # Unit density (physical unit references)
    units = UNIT_PATTERN.findall(text)
    unit_density = round(len(units) / word_count * 1000, 3)

    # Claim section analysis
    claim_section_text = ""
    m = CLAIM_START_PATTERN.search(text)
    if m:
        claim_section_text = text[m.end():]
    claim_word_count = len(claim_section_text.split())
    claim_ratio = round(claim_word_count / word_count, 3)

    # Count claim-level occurrences of surface-wave keywords
    claim_keyword_density = 0
    if claim_word_count > 0:
        claim_lower = claim_section_text.lower()
        for keywords in SURFACE_WAVE_KEYWORDS.values():
            for kw in keywords:
                claim_keyword_density += claim_lower.count(kw.lower())
        claim_keyword_density = round(
            claim_keyword_density / claim_word_count * 1000, 3
        )

    # Non-radiation distinction marker: does the doc explicitly contrast two modes?
    has_distinction = any(
        phrase in text_lower
        for phrase in [
            "not to be confounded with",
            "not radiation",
            "true conduction",
            "distinct from radiation",
            "unlike hertzian",
            "unlike radio",
            "non-radiating",
            "bound mode",
        ]
    )

    # Combine
    features = {
        "word_count": word_count,
        "number_density": number_density,
        "unit_density": unit_density,
        "claim_ratio": claim_ratio,
        "claim_keyword_density": claim_keyword_density,
        "has_non_radiation_distinction": int(has_distinction),
        **keyword_features,
    }

    return {
        "id": metadata["id"],
        "title": metadata["title"],
        "year": metadata.get("year"),
        "type": metadata.get("type"),
        "features": features,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    CORPUS_DIR.mkdir(exist_ok=True)

    # Documents to ingest — will be populated from pulled sources
    docs = []
    manifest_path = CORPUS_DIR / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            docs = json.load(f)
    else:
        print(f"No manifest at {manifest_path} — create one after pulling documents")
        return

    results = []
    for entry in docs:
        doc_path = CORPUS_DIR / entry["file"]
        if not doc_path.exists():
            print(f"Missing: {doc_path}")
            continue
        with open(doc_path, "r", encoding="utf-8") as f:
            text = f.read()
        result = extract_features(text, entry)
        results.append(result)
        print(
            f"  {entry['id']}: words={result['features']['word_count']} "
            f"numbers={result['features']['number_density']:.1f}/1k "
            f"claim_kw_density={result['features']['claim_keyword_density']:.1f}/1k "
            f"distinction={result['features']['has_non_radiation_distinction']}"
        )

    with open(OUTPUT_DIR / "features.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nWrote {len(results)} feature vectors to {OUTPUT_DIR / 'features.json'}")


if __name__ == "__main__":
    main()
