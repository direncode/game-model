"""Validate a physics BTUT lattice against the 7 known physics lineages.

The Phase 0 handoff document defines 7 validation lineages for Phase 1:

    1. Maxwell -> QED
    2. Einstein -> General Relativity
    3. Boltzmann -> Condensed Matter / Stat Mech
    4. Feynman -> QFT
    5. Dirac -> Quantum Mechanics
    6. Heisenberg -> Quantum Optics (+ uncertainty)
    7. Planck -> Statistical Physics / Thermodynamics

For each lineage this validator:

1. Constructs a probe query from the historical ancestor's name + a short
   description of their seminal contribution
2. Runs the query against the physics lattice via the combined ranking
3. Checks whether the modern descendant domain appears in the top-20 by
   keyword matching on the returned entity names
4. Reports hit / miss per lineage and an aggregate hit rate

Phase 0 handoff requires >=6 of 7 for the Phase 2 go/no-go gate. On the
50k smoke slice we only expect a subset to hit because the slice is not
large enough to cover all historical-modern pairs — the test reports
raw numbers honestly.

Usage::

    PYTHONPATH=backend:scripts/cross_era_analysis python \\
        scripts/cross_era_analysis/latk_tool/scale/validate_physics_lineages.py \\
        --lattice scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
for p in (BACKEND_DIR, CEA_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from latk_tool.query.novelty import load_lattice, query_novelty  # noqa: E402


@dataclass
class Lineage:
    name: str
    ancestor: str
    probe_query: str
    descendant_keywords: List[str]
    ancestor_keywords: List[str] = field(default_factory=list)


LINEAGES: List[Lineage] = [
    Lineage(
        name="Maxwell -> QED",
        ancestor="Maxwell",
        probe_query=(
            "Electromagnetic field theory based on Maxwell's equations "
            "describing electric and magnetic fields as a unified vector "
            "field propagating at the speed of light through space"
        ),
        descendant_keywords=[
            "qed", "quantum_electrodynam", "photon", "gauge",
            # arXiv category slugs as they appear in LATK entity names
            "hep_th", "hep_ph", "quant_ph", "physics_optics",
        ],
        ancestor_keywords=["maxwell", "electromagnet", "field_equation"],
    ),
    Lineage(
        name="Einstein -> General Relativity",
        ancestor="Einstein",
        probe_query=(
            "Spacetime curvature from mass-energy distribution with "
            "geodesic motion of test particles determined by the metric "
            "tensor field solving Einstein's field equations"
        ),
        descendant_keywords=[
            "general_relativ", "spacetime", "metric", "einstein_field",
            "gr_qc", "astro_ph", "hep_th",
        ],
        ancestor_keywords=["einstein", "gravit", "curvature"],
    ),
    Lineage(
        name="Boltzmann -> Condensed Matter",
        ancestor="Boltzmann",
        probe_query=(
            "Statistical ensemble of particles in thermal equilibrium "
            "described by entropy and partition function following "
            "Boltzmann's statistical mechanics framework"
        ),
        descendant_keywords=[
            "condensed_matter", "stat_mech", "ising", "lattice_model", "phase_transition",
            "cond_mat", "stat_mech", "physics_soc_ph",
        ],
        ancestor_keywords=["boltzmann", "entropy", "statistical"],
    ),
    Lineage(
        name="Feynman -> QFT",
        ancestor="Feynman",
        probe_query=(
            "Path integral formulation of quantum mechanics with sum over "
            "histories and Feynman diagrams for perturbative calculations "
            "of scattering amplitudes"
        ),
        descendant_keywords=[
            "quantum_field", "path_integral", "feynman_diagram", "scattering",
            "hep_th", "hep_ph", "quant_ph",
        ],
        ancestor_keywords=["feynman"],
    ),
    Lineage(
        name="Dirac -> Quantum Mechanics",
        ancestor="Dirac",
        probe_query=(
            "Relativistic wave equation for fermions with spinor solutions "
            "predicting antiparticles and the Dirac sea interpretation of "
            "the negative energy states"
        ),
        descendant_keywords=[
            "quantum_mechanic", "spinor", "fermion", "antiparticle", "dirac_equation",
            "quant_ph", "hep_th", "cond_mat_quant_gas",
        ],
        ancestor_keywords=["dirac"],
    ),
    Lineage(
        name="Heisenberg -> Quantum Optics",
        ancestor="Heisenberg",
        probe_query=(
            "Uncertainty principle constraining simultaneous measurement "
            "of position and momentum in the matrix mechanics formulation "
            "of quantum theory"
        ),
        descendant_keywords=[
            "quantum_optic", "photon", "uncertainty", "matrix_mechanic", "squeezed",
            "quant_ph", "physics_optics",
        ],
        ancestor_keywords=["heisenberg", "uncertainty"],
    ),
    Lineage(
        name="Planck -> Statistical Physics",
        ancestor="Planck",
        probe_query=(
            "Blackbody radiation spectrum from quantized energy exchange "
            "with the electromagnetic field as derived from Planck's "
            "quantum hypothesis and the constant h"
        ),
        descendant_keywords=[
            "thermodynam", "blackbody", "planck_distribution",
            "cond_mat_stat_mech", "cond_mat_dis_nn", "physics_gen_ph", "quant_ph",
        ],
        ancestor_keywords=["planck", "quantum_of_action"],
    ),
]


@dataclass
class LineageResult:
    lineage: str
    ancestor_hit: bool
    descendant_hit: bool
    top_entity_names: List[str]
    novelty: float


def validate_lineages(lattice_path: Path, top_k: int = 20) -> List[LineageResult]:
    lattice = load_lattice(lattice_path)
    print(f"Loaded lattice: {lattice.size} survivors, has_v2={lattice.has_v2}")
    print(f"Ranking mode: {'combined (v2)' if lattice.has_v2 else 'hamming (legacy)'}")
    print()

    results: List[LineageResult] = []

    for lineage in LINEAGES:
        print(f"[{lineage.name}]")
        # Restrict to content-bearing entity types. Author `person` entities
        # have minimal text and dominate the 8D neighborhood otherwise.
        report = query_novelty(
            lineage.probe_query,
            lattice,
            top_k=top_k,
            method="combined",
            entity_types=["writing", "chunk"],
        )
        names = [m.entity_name.lower() for m in report.nearest_entities[:top_k]]

        ancestor_hit = any(
            any(k in n for k in lineage.ancestor_keywords)
            for n in names
        )
        descendant_hit = any(
            any(k in n for k in lineage.descendant_keywords)
            for n in names
        )

        print(f"  query : {lineage.probe_query[:80]}...")
        print(f"  top 5 : {[n[:50] for n in names[:5]]}")
        print(f"  ancestor_hit  : {ancestor_hit}")
        print(f"  descendant_hit: {descendant_hit}")
        print(f"  novelty       : {report.novelty_score:.4f}")
        print()

        results.append(
            LineageResult(
                lineage=lineage.name,
                ancestor_hit=ancestor_hit,
                descendant_hit=descendant_hit,
                top_entity_names=names[:10],
                novelty=report.novelty_score,
            )
        )

    return results


def summarize(results: List[LineageResult]) -> dict:
    total = len(results)
    descendant_hits = sum(1 for r in results if r.descendant_hit)
    ancestor_hits = sum(1 for r in results if r.ancestor_hit)
    full_hits = sum(1 for r in results if r.ancestor_hit and r.descendant_hit)

    print("=" * 72)
    print("LATK Phase 1 Physics Lineage Validation Summary")
    print("=" * 72)
    print(f"  Lineages tested     : {total}")
    print(f"  Ancestor hit rate   : {ancestor_hits}/{total} ({100*ancestor_hits/total:.0f}%)")
    print(f"  Descendant hit rate : {descendant_hits}/{total} ({100*descendant_hits/total:.0f}%)")
    print(f"  Full (both) hit rate: {full_hits}/{total} ({100*full_hits/total:.0f}%)")
    print()
    print("Phase 0 handoff gate: >=6 of 7 descendant hits for Phase 2 go/no-go.")
    print("On a 50k smoke slice we report raw numbers honestly without gating.")
    print("=" * 72)

    return {
        "total": total,
        "ancestor_hits": ancestor_hits,
        "descendant_hits": descendant_hits,
        "full_hits": full_hits,
        "results": [
            {
                "lineage": r.lineage,
                "ancestor_hit": r.ancestor_hit,
                "descendant_hit": r.descendant_hit,
                "novelty": r.novelty,
                "top_entity_names": r.top_entity_names,
            }
            for r in results
        ],
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--lattice",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_btut_result_v2.json",
    )
    p.add_argument(
        "--report",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_lineage_validation.json",
    )
    p.add_argument("--top-k", type=int, default=20)
    args = p.parse_args()

    results = validate_lineages(args.lattice, top_k=args.top_k)
    summary = summarize(results)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with args.report.open("w", encoding="utf-8") as fp:
        json.dump(summary, fp, indent=2)
    print(f"\nReport written to: {args.report}")


if __name__ == "__main__":
    main()
