"""Extract topic-specific sections from the Richter translation of Leonardo's
notebooks (Volumes 1 and 2 combined) and save them as separate files for the
cross-era analysis corpus.
"""

from __future__ import annotations

import re
from pathlib import Path

DOCS = Path(__file__).parent / "documents"


def load_notebooks() -> str:
    """Load both volumes of Leonardo's notebooks into one text."""
    vol1 = (DOCS / "leonardo_vol1_raw.txt").read_text(encoding="utf-8", errors="ignore")
    vol2 = (DOCS / "leonardo_vol2_raw.txt").read_text(encoding="utf-8", errors="ignore")
    return vol1 + "\n\n" + vol2


def extract_contexts(text: str, keywords: list[str], window_chars: int = 800) -> list[str]:
    """Extract ~window_chars contexts around each keyword match."""
    text_lower = text.lower()
    contexts = []
    seen_positions = set()

    for kw in keywords:
        kw_lower = kw.lower()
        start = 0
        while True:
            idx = text_lower.find(kw_lower, start)
            if idx == -1:
                break

            # Skip if we've already captured a nearby passage
            skip = False
            for seen in seen_positions:
                if abs(idx - seen) < window_chars // 2:
                    skip = True
                    break

            if not skip:
                ctx_start = max(0, idx - window_chars // 2)
                ctx_end = min(len(text), idx + window_chars // 2)
                context = text[ctx_start:ctx_end].strip()
                if len(context.split()) >= 20:
                    contexts.append(context)
                    seen_positions.add(idx)

            start = idx + len(kw_lower)

    return contexts


def save_section(filename: str, source_label: str, contexts: list[str], max_words: int = 3000) -> int:
    """Save contexts as a single file with source header, limited to max_words."""
    header = f"SOURCE: {source_label}\nCITATION: Richter translation, Project Gutenberg #5000 and #4999\n\n"

    body_chunks = []
    word_count = 0
    for ctx in contexts:
        words = ctx.split()
        if word_count + len(words) > max_words:
            break
        body_chunks.append(ctx)
        word_count += len(words)

    body = "\n\n---\n\n".join(body_chunks)
    full = header + body

    out_path = DOCS / filename
    out_path.write_text(full, encoding="utf-8")
    return word_count


def main() -> None:
    text = load_notebooks()
    print(f"Loaded {len(text.split())} words of Leonardo notebook text")
    print()

    # Flight and bird mechanics
    flight_kws = [
        "bird", "flight", "flying", "wing", "feather", "plumage",
        "aerial", "flyer", "soar", "glide", "aeroplane",
    ]
    flight_contexts = extract_contexts(text, flight_kws, window_chars=1000)
    wc = save_section(
        "leonardo_flight_of_birds.txt",
        "Leonardo's Notebooks - Flight and Bird Mechanics passages",
        flight_contexts,
        max_words=3000,
    )
    print(f"  leonardo_flight_of_birds.txt: {wc} words from {len(flight_contexts)} contexts")

    # Hydraulics, water motion, turbulence
    fluid_kws = [
        "turbulen", "whirl", "eddy", "vortex", "water current",
        "water motion", "flowing water", "waves", "stream",
        "undulation", "cascade", "fluid", "water runs",
    ]
    fluid_contexts = extract_contexts(text, fluid_kws, window_chars=1000)
    wc = save_section(
        "leonardo_hydraulics_turbulence.txt",
        "Leonardo's Notebooks - Hydraulics and Turbulence passages",
        fluid_contexts,
        max_words=3000,
    )
    print(f"  leonardo_hydraulics_turbulence.txt: {wc} words from {len(fluid_contexts)} contexts")

    # Water motion (complementary section)
    water_kws = [
        "river", "current", "water", "fall of water", "water-power",
        "lake", "dam", "canal", "channel",
    ]
    water_contexts = extract_contexts(text, water_kws, window_chars=800)
    wc = save_section(
        "leonardo_water_motion.txt",
        "Leonardo's Notebooks - Water Motion and Rivers passages",
        water_contexts,
        max_words=3000,
    )
    print(f"  leonardo_water_motion.txt: {wc} words from {len(water_contexts)} contexts")

    # Anatomy
    anatomy_kws = [
        "heart", "valve", "muscle", "tendon", "bone", "anatomy",
        "nerve", "vein", "artery", "blood", "organ",
    ]
    anatomy_contexts = extract_contexts(text, anatomy_kws, window_chars=1000)
    wc = save_section(
        "leonardo_anatomy.txt",
        "Leonardo's Notebooks - Anatomy and Biomechanics passages",
        anatomy_contexts,
        max_words=3000,
    )
    print(f"  leonardo_anatomy.txt: {wc} words from {len(anatomy_contexts)} contexts")

    # Optics and perspective (control)
    optics_kws = [
        "eye sees", "vision", "light strikes", "shadow falls",
        "linear perspective", "vanishing point",
    ]
    optics_contexts = extract_contexts(text, optics_kws, window_chars=800)
    wc = save_section(
        "leonardo_optics_perspective.txt",
        "Leonardo's Notebooks - Optics and Perspective passages",
        optics_contexts,
        max_words=2500,
    )
    print(f"  leonardo_optics_perspective.txt: {wc} words from {len(optics_contexts)} contexts")

    # Art theory / painting (control - should cluster separately)
    art_kws = [
        "paint the", "the painter", "of painting", "the picture",
        "colour of", "drawing the", "paragone",
    ]
    art_contexts = extract_contexts(text, art_kws, window_chars=700)
    wc = save_section(
        "leonardo_art_control.txt",
        "Leonardo's Notebooks - Painting and Art Theory (control)",
        art_contexts,
        max_words=2500,
    )
    print(f"  leonardo_art_control.txt: {wc} words from {len(art_contexts)} contexts")


if __name__ == "__main__":
    main()
