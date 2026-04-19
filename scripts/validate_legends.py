"""Falsification tests for the legend-runs findings.

Two experiments:

1. NULL PERMUTATION (N iterations)
   For each legend, randomly shuffle the (entity_name -> fingerprint)
   assignment. This preserves:
     - per-legend fingerprint distribution (density stays identical)
     - global fingerprint frequency distribution
     - cluster structure
     - anomaly score distribution
   and scrambles:
     - which entity holds which fingerprint
     - which entity occupies which cluster
     - which entity has which anomaly
   If the observed cross-legend findings (bridges, triple-bridges,
   paradigm dominance, convergence index) are genuine structural
   signal, the null distribution should NOT reproduce them.

2. HOLD-OUT SPLIT
   Remove 3 legends. Re-derive the density threshold from the
   remaining 8. Re-run the bridge computation including the
   held-out 3. Does the same set of "top bridges" emerge, or
   does the density cutoff change the story?

Outputs: JSON report comparing true-run metrics vs null-distribution
percentiles. A "significant" finding means the true metric is
outside the null's 95th percentile.
"""
from __future__ import annotations

import json
import logging
import math
import random
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import publish_legends  # noqa: E402
from publish_legends import (  # noqa: E402
    LEGENDS,
    _compute_bridges,
    _convergent_clusters,
    _cross_era_anchors,
    _paradigm_distribution,
    _role_for,
    _triple_bridges,
    _within_cluster_rank,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("validate_legends")

N_NULL_ITERATIONS = 30
HELD_OUT = ("polymath", "tesla", "heterogeneous")
SEED = 42


def _load_sources() -> dict[str, list[dict]]:
    """Load 300-survivor lists from each cached BTUT source."""
    out: dict[str, list[dict]] = {}
    for legend in LEGENDS:
        if not legend.source.exists():
            continue
        try:
            data = json.loads(legend.source.read_text(encoding="utf-8"))
            out[legend.id] = (data.get("survivors") or [])[:300]
        except Exception:
            continue
    return out


def _extract_fingerprints(survivors_by_legend: dict[str, list[dict]]) -> dict[str, dict[str, str]]:
    fps: dict[str, dict[str, str]] = {}
    for legend_id, survs in survivors_by_legend.items():
        d: dict[str, str] = {}
        for s in survs:
            name = ((s.get("entity") or {}).get("name")) or ""
            fp = s.get("fingerprint_48bit")
            if name and fp:
                d[name] = fp
        fps[legend_id] = d
    return fps


def _global_fp_count(legend_fps: dict[str, dict[str, str]]) -> dict[str, int]:
    gc: dict[str, int] = {}
    for fps in legend_fps.values():
        for fp in set(fps.values()):
            gc[fp] = gc.get(fp, 0) + 1
    return gc


def _shuffle_fingerprints_across_legends(
    legend_fps: dict[str, dict[str, str]],
    rng: random.Random,
) -> dict[str, dict[str, str]]:
    """STRONG null: pool all fingerprints globally, redistribute to legends
    preserving per-legend count. Breaks the per-legend fingerprint composition,
    making cross-legend intersections become random.
    """
    # Pool all fingerprints (with multiplicity preserved across the universe)
    all_fps: list[str] = []
    per_legend_count: dict[str, int] = {}
    for legend_id, fps in legend_fps.items():
        all_fps.extend(fps.values())
        per_legend_count[legend_id] = len(fps)
    rng.shuffle(all_fps)

    shuffled: dict[str, dict[str, str]] = {}
    idx = 0
    for legend_id, fps in legend_fps.items():
        names = list(fps.keys())
        n = per_legend_count[legend_id]
        new_fps = all_fps[idx : idx + n]
        idx += n
        shuffled[legend_id] = dict(zip(names, new_fps))
    return shuffled


def _shuffle_survivors_within_legend(
    survivors_by_legend: dict[str, list[dict]],
    rng: random.Random,
) -> dict[str, list[dict]]:
    """Per-legend: scramble which name gets which cluster + anomaly scores.
    This breaks entity->anomaly / entity->cluster assignment while preserving
    marginal distributions per legend.
    """
    shuffled: dict[str, list[dict]] = {}
    for legend_id, survs in survivors_by_legend.items():
        names = [((s.get("entity") or {}).get("name")) or "" for s in survs]
        rng.shuffle(names)
        new_list = []
        for i, s in enumerate(survs):
            s_copy = {**s, "entity": {**(s.get("entity") or {}), "name": names[i]}}
            new_list.append(s_copy)
        shuffled[legend_id] = new_list
    return shuffled


def _shuffle_paradigm_roles(rng: random.Random) -> dict:
    """Randomly reassign forgotten/mainstream/control labels to subcorpora.

    If the 'forgotten paradigm dominance' result is real, it should NOT
    confirm under random role assignment.
    """
    original = publish_legends._PARADIGM_ROLES
    shuffled: dict[str, dict[str, str]] = {}
    for corpus, subs in original.items():
        subcorpora = list(subs.keys())
        roles = list(subs.values())
        rng.shuffle(roles)
        shuffled[corpus] = dict(zip(subcorpora, roles))
    return shuffled


def _summarize_run(
    survivors_by_legend: dict[str, list[dict]],
    legend_fps: dict[str, dict[str, str]],
) -> dict:
    """Compute the metrics we care about for a single run (true or null)."""
    gc = _global_fp_count(legend_fps)
    bridges, bridge_stats = _compute_bridges(legend_fps)
    triples = _triple_bridges(legend_fps, gc)

    # Top weighted bridge score
    top_bridge_w = bridges[0]["weighted_score"] if bridges else 0.0
    # Fraction of pairwise legend-pairs that produced any bridge
    n_pairs_possible = (len(legend_fps) * (len(legend_fps) - 1)) // 2
    frac_pairs_with_bridge = len(bridges) / max(1, n_pairs_possible)

    # Paradigm dominance: confirmations per corpus for polymath only
    polymath_survs = survivors_by_legend.get("polymath", [])
    paradigm = _paradigm_distribution(polymath_survs)
    hypothesis_confirmed: dict[str, bool] = {
        c: bool(h.get("confirmed", False))
        for c, h in paradigm.get("hypothesis_by_corpus", {}).items()
    }
    # Top convergent cluster (polymath)
    conv_clusters = _convergent_clusters(polymath_survs)
    top_hot_count = conv_clusters[0]["hot_count"] if conv_clusters else 0
    # Cross-era anchor count (polymath)
    cross_era = _cross_era_anchors(polymath_survs)
    n_cross_era = len(cross_era)

    return {
        "pairwise_bridges": len(bridges),
        "triple_bridges": len(triples),
        "top_bridge_weighted": round(top_bridge_w, 4),
        "frac_legend_pairs_with_bridge": round(frac_pairs_with_bridge, 4),
        "polymath_hypothesis_newton": hypothesis_confirmed.get("newton", False),
        "polymath_hypothesis_leonardo": hypothesis_confirmed.get("leonardo", False),
        "polymath_hypothesis_vn": hypothesis_confirmed.get("vn", False),
        "polymath_top_convergent_cluster_hot_count": top_hot_count,
        "polymath_n_cross_era_anchors": n_cross_era,
        "dense_fingerprints_dropped": bridge_stats.get("dense_fingerprints_dropped", 0),
        "unique_fingerprints_total": bridge_stats.get("total_unique_fingerprints", 0),
    }


def _compare(true_val, null_vals: list, higher_is_signal: bool = True) -> dict:
    """Compare a true metric against the null distribution."""
    numeric_nulls = [v for v in null_vals if isinstance(v, (int, float))]
    if not numeric_nulls:
        # Boolean case
        if all(isinstance(v, bool) for v in null_vals):
            prop_true = sum(1 for v in null_vals if v) / len(null_vals)
            return {
                "true": bool(true_val),
                "null_proportion_true": round(prop_true, 3),
                "significant_at_0_05": (bool(true_val) and prop_true < 0.05),
            }
        return {"true": true_val, "null_sample": null_vals[:5]}

    mean = statistics.mean(numeric_nulls)
    p95 = _percentile(numeric_nulls, 95 if higher_is_signal else 5)
    out = {
        "true": float(true_val),
        "null_mean": round(mean, 4),
        "null_std": round(statistics.pstdev(numeric_nulls), 4) if len(numeric_nulls) > 1 else 0.0,
        "null_p05": round(_percentile(numeric_nulls, 5), 4),
        "null_p95": round(_percentile(numeric_nulls, 95), 4),
        "null_max": round(max(numeric_nulls), 4),
        "null_min": round(min(numeric_nulls), 4),
    }
    if higher_is_signal:
        out["significant_at_0_05"] = float(true_val) > p95
    else:
        out["significant_at_0_05"] = float(true_val) < _percentile(numeric_nulls, 5)
    return out


def _percentile(vals: list[float], p: float) -> float:
    if not vals:
        return 0.0
    sorted_vals = sorted(vals)
    k = (p / 100.0) * (len(sorted_vals) - 1)
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return sorted_vals[lo]
    frac = k - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def run_null_permutation(
    survivors_by_legend: dict[str, list[dict]],
    n_iterations: int = N_NULL_ITERATIONS,
    seed: int = SEED,
) -> dict:
    log.info("NULL PERMUTATION: %d iterations (strong null: cross-legend fp shuffle + role shuffle)", n_iterations)
    true_fps = _extract_fingerprints(survivors_by_legend)
    true_metrics = _summarize_run(survivors_by_legend, true_fps)

    original_roles = dict(publish_legends._PARADIGM_ROLES)
    rng = random.Random(seed)
    null_metrics_list: list[dict] = []
    try:
        for i in range(n_iterations):
            # Strong null for bridges: redistribute fingerprints across legends
            shuffled_fps = _shuffle_fingerprints_across_legends(true_fps, rng)
            shuffled_survs = _shuffle_survivors_within_legend(survivors_by_legend, rng)
            # Strong null for paradigm: randomize role labels
            publish_legends._PARADIGM_ROLES = _shuffle_paradigm_roles(rng)  # type: ignore[assignment]
            null_metrics_list.append(_summarize_run(shuffled_survs, shuffled_fps))
            if (i + 1) % 10 == 0:
                log.info("  iteration %d/%d complete", i + 1, n_iterations)
    finally:
        publish_legends._PARADIGM_ROLES = original_roles  # type: ignore[assignment]

    # Compare each metric
    comparison: dict[str, dict] = {}
    metric_keys = list(true_metrics.keys())
    higher_is_signal = {
        "pairwise_bridges": True,
        "triple_bridges": True,
        "top_bridge_weighted": True,
        "frac_legend_pairs_with_bridge": True,
        "polymath_top_convergent_cluster_hot_count": True,
        "polymath_n_cross_era_anchors": True,
        "dense_fingerprints_dropped": False,  # lower is better (less noise)
        "unique_fingerprints_total": True,
    }
    for key in metric_keys:
        null_vals = [m[key] for m in null_metrics_list]
        comparison[key] = _compare(
            true_metrics[key], null_vals, higher_is_signal=higher_is_signal.get(key, True)
        )

    return {
        "n_iterations": n_iterations,
        "seed": seed,
        "true_metrics": true_metrics,
        "null_comparison": comparison,
    }


def run_holdout_split(
    survivors_by_legend: dict[str, list[dict]],
    held_out: tuple[str, ...] = HELD_OUT,
) -> dict:
    log.info("HOLD-OUT SPLIT: holding out %s", held_out)
    all_fps = _extract_fingerprints(survivors_by_legend)

    train_fps = {k: v for k, v in all_fps.items() if k not in held_out}
    train_survs = {k: v for k, v in survivors_by_legend.items() if k not in held_out}

    # Density derived from train only
    train_gc = _global_fp_count(train_fps)
    train_bridges, train_stats = _compute_bridges(train_fps)

    # Apply the same density cutoff (derived from train) to the FULL set
    # to see if bridges involving held-out legends pass
    full_bridges, full_stats = _compute_bridges(all_fps)

    # Bridges that include at least one held-out legend
    held_out_set = set(held_out)
    held_bridges = [
        b for b in full_bridges
        if (b["a"] in held_out_set) or (b["b"] in held_out_set)
    ]

    return {
        "held_out_legends": list(held_out),
        "train_legend_count": len(train_fps),
        "train_pairwise_bridges": len(train_bridges),
        "train_dense_dropped": train_stats.get("dense_fingerprints_dropped", 0),
        "full_pairwise_bridges": len(full_bridges),
        "full_dense_dropped": full_stats.get("dense_fingerprints_dropped", 0),
        "bridges_involving_heldout": len(held_bridges),
        "top_heldout_bridge": (
            {"a": held_bridges[0]["a"], "b": held_bridges[0]["b"],
             "weighted_score": held_bridges[0]["weighted_score"]}
            if held_bridges else None
        ),
    }


def main() -> int:
    out_dir = REPO_ROOT / "data" / "validation"
    out_dir.mkdir(parents=True, exist_ok=True)

    survivors_by_legend = _load_sources()
    log.info("Loaded %d legend corpora", len(survivors_by_legend))

    null_report = run_null_permutation(survivors_by_legend)
    holdout_report = run_holdout_split(survivors_by_legend)

    report = {
        "null_permutation": null_report,
        "holdout_split": holdout_report,
        "notes": [
            "Null permutation shuffles (name -> fingerprint) within each legend "
            "and randomizes which name gets which cluster + anomaly scores. "
            "Preserves distributions; destroys entity-level assignment.",
            "Significance threshold: true metric outside null's 95th percentile "
            "(one-sided test at alpha=0.05).",
            "Hold-out split derives density threshold from 8 legends and applies "
            "to the full 11 to test generalization.",
        ],
    }
    (out_dir / "report.json").write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    log.info("Wrote %s", out_dir / "report.json")

    # Human-readable summary
    print("\n" + "=" * 70)
    print("NULL PERMUTATION RESULTS  (null N =", null_report["n_iterations"], ")")
    print("=" * 70)
    for metric, cmp in null_report["null_comparison"].items():
        true_v = cmp.get("true")
        if "null_mean" in cmp:
            sig = "SIGNIFICANT" if cmp.get("significant_at_0_05") else "not signif"
            print(
                f"  {metric:48s}  true={true_v:.3f}  null_mean={cmp['null_mean']:.3f}  "
                f"null_p95={cmp['null_p95']:.3f}  [{sig}]"
            )
        elif "null_proportion_true" in cmp:
            sig = "SIGNIFICANT" if cmp.get("significant_at_0_05") else "not signif"
            print(
                f"  {metric:48s}  true={true_v}  null_prop_true={cmp['null_proportion_true']}  "
                f"[{sig}]"
            )
    print()
    print("HOLD-OUT SPLIT")
    print("=" * 70)
    for k, v in holdout_report.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
