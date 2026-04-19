"""4th-figure replication: Alan Turing corpus.

Extends the polymath methodology to a figure outside the Newton / Von
Neumann / Leonardo triad. Hypothesis (from the polymath design lens):

  forgotten paradigm  = morphogenesis / reaction-diffusion (Turing 1952)
  mainstream          = computability, Turing machine (1936+)
  control             = cryptanalysis (Bletchley, classified)

If BTUT anomaly detection finds morphogenesis entries dominating the
forgotten-paradigm ratio (per lo_core's hypothesis test), the
methodology replicates. If not, that's falsification — equally real
science.

Corpus constructed from Turing's actual writings + known entities.
Runs through `run_btut_pipeline` on the real backend BTUT to produce
a legend-shaped JSON + lo_core analysis.
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

# Silence dotenv conflicts (same fix as load test)
for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("turing_corpus")


# ─── Turing corpus ───────────────────────────────────────────────────────────
# Subcorpora tagged with role (forgotten / mainstream / control) for the
# lo_core paradigm test. Entity names use the same structured format as
# the polymath corpus: corpus__kind__slug.

TURING_ENTITIES: list[dict] = []

def _add(subcorpus: str, kind: str, slug: str) -> None:
    TURING_ENTITIES.append({
        "name": f"turing_{subcorpus}__{kind}__{slug}",
        "type": kind,
        "attributes": {"subcorpus": subcorpus, "era": "historical"},
    })

# --- Forgotten paradigm: morphogenesis / reaction-diffusion ---
for slug in [
    "reaction_diffusion_model", "turing_patterns", "morphogen_gradient",
    "zebra_stripes_explained", "dappled_leaves", "activator_inhibitor_system",
    "chemical_basis_of_morphogenesis_1952", "biological_instability",
    "spatial_symmetry_breaking",
]:
    _add("morphogenesis", "concept", slug)
for slug in ["cambridge_plant_lab", "manchester_chemistry_department"]:
    _add("morphogenesis", "location", slug)
for slug in ["morphogenesis_paper_published", "turing_studies_fibonacci_plants"]:
    _add("morphogenesis", "event", slug)

# --- Mainstream: computability ---
for slug in [
    "universal_turing_machine", "halting_problem", "decision_problem",
    "turing_completeness", "entscheidungsproblem_solved_1936",
    "lambda_calculus_equivalent", "effective_calculability",
    "computable_numbers",
]:
    _add("computability", "concept", slug)
for slug in ["princeton_university", "kings_college_cambridge"]:
    _add("computability", "location", slug)
for slug in ["on_computable_numbers_published_1936", "turing_phd_defended_1938"]:
    _add("computability", "event", slug)

# --- Control: cryptanalysis (intentionally the CONTROL paradigm here) ---
for slug in [
    "enigma_machine", "bombe_device", "banburismus", "turingery",
    "naval_enigma_cracked", "lorenz_cipher", "colossus_built",
]:
    _add("cryptanalysis", "concept", slug)
for slug in ["bletchley_park", "hut_8", "government_code_and_cypher_school"]:
    _add("cryptanalysis", "location", slug)
for slug in ["enigma_cracked_1940", "battle_of_atlantic_signals_decoded"]:
    _add("cryptanalysis", "event", slug)

# --- AI / imitation game (also mainstream; later work) ---
for slug in [
    "imitation_game", "turing_test", "can_machines_think",
    "computing_machinery_and_intelligence_1950",
]:
    _add("ai", "concept", slug)

# --- Modern descendants (era=modern to enable cross-era anchor detection) ---
MODERN_DESCENDANTS = [
    ("modern_complexity", "concept", "p_vs_np"),
    ("modern_complexity", "concept", "cook_levin_theorem"),
    ("modern_complexity", "location", "clay_mathematics_institute"),
    ("modern_ai", "concept", "deep_learning"),
    ("modern_ai", "concept", "chain_of_thought"),
    ("modern_cryptography", "concept", "rsa_algorithm"),
    ("modern_cryptography", "concept", "post_quantum_lattice"),
    ("modern_morphogenesis", "concept", "gene_regulatory_network"),
    ("modern_morphogenesis", "concept", "biological_pattern_formation"),
    ("modern_morphogenesis", "concept", "synthetic_biology_turing_patterns"),
]
for sub, kind, slug in MODERN_DESCENDANTS:
    TURING_ENTITIES.append({
        "name": f"{sub}__{kind}__{slug}",
        "type": kind,
        "attributes": {"subcorpus": sub, "era": "modern"},
    })

# --- Edges: successor / descendant links ---
EDGES = []
for i in range(len(TURING_ENTITIES) - 1):
    EDGES.append({
        "source": TURING_ENTITIES[i]["name"],
        "target": TURING_ENTITIES[i + 1]["name"],
        "type": "succeeds",
        "weight": 1.0,
    })


def run_btut_on_turing_corpus() -> dict:
    """Invoke the real BTUT pipeline on the Turing corpus."""
    from app.services.btut.pipeline import run_btut_pipeline

    unique_types = sorted({e["type"] for e in TURING_ENTITIES})
    log.info(
        "Running BTUT on Turing corpus: %d entities, %d edges, %d types",
        len(TURING_ENTITIES), len(EDGES), len(unique_types),
    )
    return run_btut_pipeline(
        entities=TURING_ENTITIES,
        edges=EDGES,
        unique_types=unique_types,
        target_survivors=25,
        budget_dollars=1.0,
        resolutions=[4, 8],
        n_rotations=4,
    )


def lo_analyze_turing(btut_result: dict) -> dict:
    """Run lo_core analyzers against the Turing BTUT result."""
    from lo_core import analyze_corpus
    from lo_core.analyze import DEFAULT_PARADIGM_ROLES

    # Extend DEFAULT_PARADIGM_ROLES for Turing
    role_map = {
        **DEFAULT_PARADIGM_ROLES,
        "turing": {
            "morphogenesis": "forgotten",
            "computability": "mainstream",
            "ai": "mainstream",
            "cryptanalysis": "control",
        },
    }

    from dataclasses import asdict, is_dataclass
    def jsonable(o):
        if is_dataclass(o):
            return jsonable(asdict(o))
        if isinstance(o, dict):
            return {k: jsonable(v) for k, v in o.items()}
        if isinstance(o, list):
            return [jsonable(v) for v in o]
        return o

    findings = analyze_corpus(
        btut_result.get("survivors") or [],
        corpus_id="turing",
        role_map=role_map,
    )
    return jsonable(findings)


def main() -> int:
    result = run_btut_on_turing_corpus()
    summary = result.get("summary") or {}
    n_survivors = len(result.get("survivors") or [])
    log.info("BTUT complete: %d survivors, clusters=%s",
             n_survivors, summary.get("clusters"))

    out_dir = REPO_ROOT / "scripts" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_path = out_dir / "turing_btut_result.json"
    raw_path.write_text(json.dumps(result, indent=2, sort_keys=True, default=str), encoding="utf-8")
    log.info("Saved raw BTUT to %s", raw_path)

    findings = lo_analyze_turing(result)
    findings_path = out_dir / "turing_findings.json"
    findings_path.write_text(json.dumps(findings, indent=2, sort_keys=True, default=str), encoding="utf-8")
    log.info("Saved lo_core findings to %s", findings_path)

    # Headline result
    print()
    print("=" * 70)
    print("TURING CORPUS — 4TH-FIGURE REPLICATION")
    print("=" * 70)
    hypothesis = (findings.get("paradigm_distribution") or {}).get("hypothesis_by_corpus", {}) or {}
    for corpus, h in hypothesis.items():
        confirmed = "CONFIRMED" if h.get("confirmed") else "NOT confirmed"
        print(
            f"  {corpus:14s}  forgotten={h.get('forgotten')}  "
            f"mainstream={h.get('mainstream')}  control={h.get('control')}  "
            f"ratio={h.get('ratio_forgotten_to_competitors')}  [{confirmed}]"
        )
    ci = findings.get("convergence_index") or []
    if ci:
        print(f"\n  Top convergent entity: {ci[0]['name']}  conv={ci[0]['convergence']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
