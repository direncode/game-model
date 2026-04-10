"""Pipeline signature across all crystallized corpora — domain-invariance check.

For each lattice (Phase 0 research + Phase 1 physics + Phase 1 commercial),
compute a "pipeline signature":

- total_entities (source corpus size)
- survivors (post-reduction size)
- reduction ratio
- unique 48-bit fingerprints
- cluster count
- composite-score distribution (mean, std, p5, p50, p95)
- variance_preservation
- median nearest-neighbor distance (reconstruction quality proxy)
- wall time

If BTUT's deterministic feature-composition pipeline truly produces
domain-invariant latent geometry, these signatures should follow a
recognizable pattern across independent domains — specifically:

1. Variance preservation should cluster near 1.0 (±10%) across all corpora
2. Composite-score distribution should be similar in shape (heavy tail,
   right-skewed, max near 1.0)
3. Cluster-count / survivor-count ratio should scale smoothly with corpus
   size, not wildly vary by domain
4. Wall time should be sub-quadratic in corpus size

We don't get to choose the metrics post-hoc — the signature is what comes
out of `summary` which is bit-identical across all runs.

Output: scripts/cross_era_analysis/output/domain_invariance_signature.json +
printed table.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path
from statistics import mean, stdev
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[4]
CEA = REPO_ROOT / "scripts" / "cross_era_analysis"
OUTPUT_DIR = CEA / "output"
PHASE0 = OUTPUT_DIR / "phase0_commercial"


LATTICES = [
    # name, path, domain_class, (optional human label)
    ("linguistics", OUTPUT_DIR / "linguistics_btut_result_v2.json", "research_dev", "Panini -> Transformer"),
    ("polymath", OUTPUT_DIR / "polymath_btut_result_v2.json", "research_dev", "Newton+Leonardo+VonNeumann"),
    ("heterogeneous", OUTPUT_DIR / "heterogeneous_btut_result_v2.json", "research_dev", "Tesla+Shannon+crypto"),
    ("tesla_crossera", OUTPUT_DIR / "tesla_crossera_btut_result_v2.json", "research_dev", "Tesla-era patents"),
    ("latk_mini", OUTPUT_DIR / "latk_mini_btut_result_v2.json", "research_dev", "3-domain merged"),
    ("physics_arxiv", OUTPUT_DIR / "latk_physics_btut_result_v2.json", "commercial_primary", "50k arXiv abstracts"),
    ("edgar", OUTPUT_DIR / "edgar_btut_result_v2.json", "commercial_primary", "SEC financial filings + facts"),
    # Phase 0 commercial lattices (legacy format, no embed_context)
    ("pubmed", PHASE0 / "pubmed_btut_result.json", "commercial_legacy", "biomedical literature"),
    ("patents", PHASE0 / "patents_btut_result.json", "commercial_legacy", "USPTO patents"),
    ("comtrade", PHASE0 / "comtrade_btut_result.json", "commercial_legacy", "UN trade flows"),
    ("climate", PHASE0 / "climate_btut_result.json", "commercial_legacy", "climate stations"),
]


def parse_scores(scores_field: Any) -> Dict[str, float]:
    """Survivor scores may be a dict or a stringified dict."""
    if isinstance(scores_field, dict):
        return {k: float(v) for k, v in scores_field.items()}
    try:
        d = ast.literal_eval(str(scores_field))
        return {k: float(v) for k, v in d.items()} if isinstance(d, dict) else {}
    except (ValueError, SyntaxError):
        return {}


def compute_signature(lattice_path: Path) -> Optional[Dict[str, Any]]:
    if not lattice_path.exists():
        return None
    try:
        with lattice_path.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
    except Exception as exc:
        print(f"  [warn] could not load {lattice_path}: {exc}", file=sys.stderr)
        return None

    summary = data.get("summary", {})
    survivors = data.get("survivors", [])

    # Extract composite scores
    composites: List[float] = []
    diversity: List[float] = []
    reconstruction: List[float] = []
    anomaly: List[float] = []
    for s in survivors:
        sc = parse_scores(s.get("scores", {}))
        if "composite" in sc:
            composites.append(sc["composite"])
        if "diversity" in sc:
            diversity.append(sc["diversity"])
        if "reconstruction" in sc:
            reconstruction.append(sc["reconstruction"])
        if "anomaly" in sc:
            anomaly.append(sc["anomaly"])

    def stats(vals: List[float]) -> Dict[str, float]:
        if not vals:
            return {"n": 0, "mean": None, "std": None, "p5": None, "p50": None, "p95": None}
        sv = sorted(vals)
        return {
            "n": len(vals),
            "mean": round(mean(vals), 4),
            "std": round(stdev(vals), 4) if len(vals) > 1 else 0.0,
            "p5": round(sv[max(0, int(0.05 * len(sv)))], 4),
            "p50": round(sv[len(sv) // 2], 4),
            "p95": round(sv[min(len(sv) - 1, int(0.95 * len(sv)))], 4),
            "max": round(max(vals), 4),
        }

    recon = summary.get("reconstruction", {})

    return {
        "lattice_file": lattice_path.name,
        "total_entities": summary.get("total_entities"),
        "survivors": summary.get("survivors", len(survivors)),
        "reduction": summary.get("reduction"),
        "clusters": summary.get("clusters"),
        "unique_48bit_fingerprints": summary.get("unique_48bit_fingerprints"),
        "variance_preservation": recon.get("variance_preservation"),
        "median_nn": recon.get("median_nn"),
        "mean_nn": recon.get("mean_nn"),
        "p95_nn": recon.get("p95_nn"),
        "wall_seconds": summary.get("wall_seconds"),
        "survivor_types": summary.get("survivor_types"),
        "composite": stats(composites),
        "diversity": stats(diversity),
        "reconstruction_score": stats(reconstruction),
        "anomaly": stats(anomaly),
    }


def main() -> None:
    print("=" * 80)
    print("LATK Domain-Invariance Signature — 11 corpora across 3 classes")
    print("=" * 80)

    results: List[Dict[str, Any]] = []
    for name, path, cls, label in LATTICES:
        print(f"\n[{cls}] {name}: {label}")
        sig = compute_signature(path)
        if sig is None:
            print(f"  skipped (file missing or unreadable)")
            continue
        sig["lattice_id"] = name
        sig["domain_class"] = cls
        sig["label"] = label
        results.append(sig)
        print(f"  entities={sig['total_entities']} -> survivors={sig['survivors']} ({sig['reduction']}x)")
        print(f"  clusters={sig['clusters']} unique_fp={sig['unique_48bit_fingerprints']}")
        print(f"  variance_preservation={sig['variance_preservation']}  median_nn={sig['median_nn']}")
        if sig["composite"]["n"]:
            c = sig["composite"]
            print(f"  composite: mean={c['mean']} std={c['std']} p50={c['p50']} p95={c['p95']} max={c['max']}")

    # Cross-domain comparison
    print("\n" + "=" * 80)
    print("CROSS-DOMAIN COMPARISON TABLE")
    print("=" * 80)
    header = f"{'lattice':<18} {'class':<20} {'n_src':>8} {'n_surv':>7} {'red':>5} {'clust':>6} {'var_pres':>9} {'comp_p50':>9} {'comp_p95':>9}"
    print(header)
    print("-" * len(header))
    for r in results:
        comp = r["composite"]
        vp = r["variance_preservation"]
        vp_str = f"{vp:.4f}" if vp is not None else "   -   "
        p50_str = f"{comp['p50']:.4f}" if comp["p50"] is not None else "   -   "
        p95_str = f"{comp['p95']:.4f}" if comp["p95"] is not None else "   -   "
        print(
            f"{r['lattice_id']:<18} "
            f"{r['domain_class']:<20} "
            f"{r['total_entities'] or 0:>8} "
            f"{r['survivors'] or 0:>7} "
            f"{r['reduction'] or 0:>5} "
            f"{r['clusters'] or 0:>6} "
            f"{vp_str:>9} "
            f"{p50_str:>9} "
            f"{p95_str:>9}"
        )

    # Invariance check: are the signature statistics consistent across domains?
    print("\n" + "=" * 80)
    print("DOMAIN-INVARIANCE CHECK")
    print("=" * 80)
    # Variance preservation consistency
    vps = [r["variance_preservation"] for r in results if r["variance_preservation"] is not None]
    if vps:
        vp_mean = mean(vps)
        vp_std = stdev(vps) if len(vps) > 1 else 0.0
        vp_min = min(vps)
        vp_max = max(vps)
        print(f"  variance_preservation: n={len(vps)} mean={vp_mean:.4f} std={vp_std:.4f} range=[{vp_min:.4f}, {vp_max:.4f}]")
        print(f"    -> cluster tightness: {'TIGHT (std<0.10)' if vp_std < 0.10 else 'LOOSE (std>=0.10)'}")
        print(f"    -> lower bound: {'HIGH (min>0.85)' if vp_min > 0.85 else 'MIXED' if vp_min > 0.50 else 'LOW'}")

    # Composite score p50 consistency
    p50s = [r["composite"]["p50"] for r in results if r["composite"]["p50"] is not None]
    if p50s:
        p50_mean = mean(p50s)
        p50_std = stdev(p50s) if len(p50s) > 1 else 0.0
        print(f"  composite p50:         n={len(p50s)} mean={p50_mean:.4f} std={p50_std:.4f}")
        print(f"    -> similarity: {'TIGHT (std<0.05)' if p50_std < 0.05 else 'LOOSE (std>=0.05)'}")

    # Reduction vs entities: sub-quadratic check (wall seconds if we had it all)
    print("  reduction ratio growth with corpus size:")
    by_size = sorted(results, key=lambda r: r.get("total_entities") or 0)
    for r in by_size:
        print(f"    {(r['total_entities'] or 0):>8} entities -> {r['reduction']}x reduction")

    # Write JSON report
    report_path = OUTPUT_DIR / "domain_invariance_signature.json"
    with report_path.open("w", encoding="utf-8") as fp:
        json.dump({"lattices": results}, fp, indent=2, default=str)
    print(f"\nReport saved: {report_path}")


if __name__ == "__main__":
    main()
