"""5th-figure polymath replication: Albert Einstein.

Hypothesis (from polymath design lens):
  forgotten paradigm  = unified field theory (30-year late career, failed)
  mainstream          = special/general relativity, photoelectric effect,
                        Brownian motion
  control             = Bose-Einstein statistics / quantum (mainstream
                        but distinct from relativity core)

Running: Newton + Leonardo confirmed; VN + Turing failed. Einstein is
the tiebreaker.

If confirmed: 3-of-5 split favors hypothesis on figures with large
forgotten-paradigm corpus relative to mainstream.
If failed:   3-of-5 against. Hypothesis needs reformulation or
restriction.

Builds synthetic Einstein corpus from well-known entities, runs real
BTUT pipeline, passes through lo_core for the hypothesis test.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT / "lo_core" / "src"))

for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("einstein_corpus")


EINSTEIN_ENTITIES: list[dict] = []

def _add(subcorpus: str, kind: str, slug: str, era: str = "historical") -> None:
    EINSTEIN_ENTITIES.append({
        "name": f"einstein_{subcorpus}__{kind}__{slug}",
        "type": kind,
        "attributes": {"subcorpus": subcorpus, "era": era},
    })

# Forgotten paradigm: unified field theory
for slug in [
    "unified_field_theory", "geometrodynamics", "five_dimensional_kaluza_klein",
    "teleparallel_gravity", "asymmetric_metric_field",
    "fernparallelismus", "semivector_formulation",
    "non_symmetric_generalization_of_gravity", "weylean_unification",
    "distant_parallelism_variational",
]:
    _add("unified_field", "concept", slug)
for slug in ["einstein_cartan_paper_1928", "bianchi_identity_obsession",
             "last_manuscripts_princeton_1955"]:
    _add("unified_field", "event", slug)
for slug in ["princeton_institute_late_office"]:
    _add("unified_field", "location", slug)

# Mainstream: relativity
for slug in [
    "special_relativity", "general_relativity", "equivalence_principle",
    "spacetime_curvature", "einstein_field_equations",
    "schwarzschild_solution", "perihelion_precession_of_mercury",
    "gravitational_time_dilation", "lorentz_transformation",
]:
    _add("relativity", "concept", slug)
for slug in ["annus_mirabilis_1905", "general_relativity_completed_1915",
             "eclipse_confirmation_1919"]:
    _add("relativity", "event", slug)
for slug in ["bern_patent_office", "berlin_academy", "princeton_institute"]:
    _add("relativity", "location", slug)

# Mainstream: photoelectric / Brownian
for slug in [
    "photoelectric_effect", "light_quanta", "brownian_motion",
    "mass_energy_equivalence", "bose_einstein_statistics",
    "condensate_theoretical_prediction",
]:
    _add("quantum_statistical", "concept", slug)
for slug in ["nobel_prize_1921_photoelectric"]:
    _add("quantum_statistical", "event", slug)

# Control: philosophy of science / political writings
for slug in [
    "philosophy_of_science_essays", "principle_of_causality_debates",
    "god_does_not_play_dice_letter", "realism_epr_paper",
    "pacifism_writings", "zionist_political_letters",
]:
    _add("philosophy_control", "concept", slug)

# Modern descendants — tag as modern era for cross-era anchor detection
MODERN_DESCENDANTS = [
    ("modern_grand_unified", "concept", "electroweak_unification"),
    ("modern_grand_unified", "concept", "su_5_gut"),
    ("modern_grand_unified", "concept", "string_theory_compactification"),
    ("modern_grand_unified", "concept", "m_theory_11_dimensional"),
    ("modern_grand_unified", "location", "cern_large_hadron_collider"),
    ("modern_cosmology", "concept", "inflation_theory"),
    ("modern_cosmology", "concept", "lambda_cdm_standard_model"),
    ("modern_cosmology", "concept", "gravitational_wave_detection"),
    ("modern_cosmology", "location", "ligo_hanford"),
    ("modern_quantum_field", "concept", "yang_mills_field_theory"),
    ("modern_quantum_field", "concept", "standard_model_particles"),
]
for sub, kind, slug in MODERN_DESCENDANTS:
    EINSTEIN_ENTITIES.append({
        "name": f"{sub}__{kind}__{slug}",
        "type": kind,
        "attributes": {"subcorpus": sub, "era": "modern"},
    })

# Edges — successor chain
EDGES = []
for i in range(len(EINSTEIN_ENTITIES) - 1):
    EDGES.append({
        "source": EINSTEIN_ENTITIES[i]["name"],
        "target": EINSTEIN_ENTITIES[i + 1]["name"],
        "type": "succeeds",
        "weight": 1.0,
    })


def run_btut_and_analyze() -> dict:
    from app.services.btut.pipeline import run_btut_pipeline
    from lo_core import analyze_corpus
    from lo_core.analyze import DEFAULT_PARADIGM_ROLES
    from dataclasses import asdict, is_dataclass

    def jsonable(o):
        if is_dataclass(o):
            return jsonable(asdict(o))
        if isinstance(o, dict):
            return {k: jsonable(v) for k, v in o.items()}
        if isinstance(o, list):
            return [jsonable(v) for v in o]
        return o

    types = sorted({e["type"] for e in EINSTEIN_ENTITIES})
    log.info("Running BTUT: %d entities, %d edges, types=%s",
             len(EINSTEIN_ENTITIES), len(EDGES), types)
    result = run_btut_pipeline(
        entities=EINSTEIN_ENTITIES,
        edges=EDGES,
        unique_types=types,
        target_survivors=25,
        budget_dollars=1.0,
        resolutions=[4, 8],
        n_rotations=4,
    )
    log.info("BTUT done: %d survivors, clusters=%s",
             len(result.get("survivors") or []),
             (result.get("summary") or {}).get("clusters"))

    role_map = {
        **DEFAULT_PARADIGM_ROLES,
        "einstein": {
            "unified_field": "forgotten",
            "relativity": "mainstream",
            "quantum_statistical": "mainstream",
            "philosophy_control": "control",
        },
    }
    findings = analyze_corpus(
        result.get("survivors") or [],
        corpus_id="einstein",
        role_map=role_map,
    )
    findings_json = jsonable(findings)

    out_dir = REPO_ROOT / "scripts" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "einstein_btut_result.json").write_text(
        json.dumps(result, indent=2, sort_keys=True, default=str), encoding="utf-8")
    (out_dir / "einstein_findings.json").write_text(
        json.dumps(findings_json, indent=2, sort_keys=True, default=str), encoding="utf-8")

    return {"result": result, "findings": findings_json}


def main() -> int:
    out = run_btut_and_analyze()
    findings = out["findings"]
    hypothesis = (findings.get("paradigm_distribution") or {}).get("hypothesis_by_corpus", {})

    print()
    print("=" * 72)
    print("EINSTEIN — 5TH FIGURE REPLICATION")
    print("=" * 72)
    for corpus, h in hypothesis.items():
        verdict = "CONFIRMED" if h.get("confirmed") else "NOT confirmed"
        print(f"  {corpus:16s}  forgotten={h.get('forgotten')}  "
              f"mainstream={h.get('mainstream')}  control={h.get('control')}  "
              f"ratio={h.get('ratio_forgotten_to_competitors')}  [{verdict}]")

    ci = findings.get("convergence_index") or []
    if ci:
        print(f"\n  Top convergent entity: {ci[0]['name']}  conv={ci[0]['convergence']}")

    # Running tally across all 5 figures
    confirmations = {
        "newton":   True,
        "leonardo": True,
        "vn":       False,
        "turing":   False,
    }
    einstein_confirmed = bool(hypothesis.get("einstein", {}).get("confirmed"))
    confirmations["einstein"] = einstein_confirmed
    print()
    print("=" * 72)
    print("FIVE-FIGURE SCOREBOARD")
    print("=" * 72)
    for fig, c in confirmations.items():
        print(f"  {fig:10s}: {'CONFIRMED' if c else 'NOT confirmed'}")
    total = sum(int(c) for c in confirmations.values())
    print(f"\n  Confirmations: {total}/5")
    if total >= 3:
        print("  -> Hypothesis favored by the 5-figure panel")
    else:
        print("  -> Hypothesis not favored by the 5-figure panel")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
