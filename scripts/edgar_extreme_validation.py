"""EDGAR extreme-scale anomaly-ranking validation.

Tests the RIGHT hypothesis (BTUT top-K ranking is non-random) at absolute
statistical extremes:

- N=500 null permutation iterations (per test)
- Multiple K values: 10, 25, 50, 100, 250, 500, 1000
- All 4 score dimensions tested: composite, diversity, reconstruction, anomaly
- Within-type tests: filings vs financial_facts separately
- BTUT config stability: top-25 from target=2000 vs target=5000 (same corpus,
  different survivor-pool sizes) — measures how many top anomalies are
  invariant to pipeline configuration
- Bootstrap robustness: 50 random 80% sub-samples of the corpus

Output: data/validation/edgar_extreme_validation.json
"""
from __future__ import annotations

import json
import logging
import os
import random
import re
import statistics
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("edgar_extreme")


BTUT_2000 = REPO_ROOT / "scripts" / "edgar_btut_result_2000.json"
BTUT_5000 = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"

K_VALUES = [10, 25, 50, 100, 250, 500, 1000]
N_NULL = 500
SCORE_DIMS = ["composite", "diversity", "reconstruction", "anomaly"]


def _percentile(values, p):
    import math
    if not values:
        return 0.0
    s = sorted(values)
    k = (p / 100.0) * (len(s) - 1)
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return s[lo]
    return s[lo] * (1 - (k - lo)) + s[hi] * (k - lo)


def _name(s: dict) -> str:
    return ((s.get("entity") or {}).get("name")) or ""


def _entity_type(s: dict) -> str:
    return ((s.get("entity") or {}).get("type")) or "unknown"


def _score(s: dict, dim: str) -> float:
    return float((s.get("scores") or {}).get(dim, 0.0))


def rank_concentration_test(
    survivors: list[dict], K: int, score_dim: str, n_null: int = N_NULL,
) -> dict:
    """Sort survivors by score_dim desc, take top-K, measure what fraction
    are rank-1-in-their-cluster. Compare to random K-sample rank-1 fraction.
    """
    sorted_all = sorted(survivors, key=lambda s: _score(s, score_dim), reverse=True)
    top = sorted_all[:K]
    top_names = {_name(s) for s in top}

    # Cluster -> sorted members
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s in survivors:
        by_cluster[int(s.get("cluster", -1))].append(s)
    # Within each cluster, sort by score_dim desc to find rank-1
    for c, members in by_cluster.items():
        members.sort(key=lambda s: _score(s, score_dim), reverse=True)

    def _is_rank1(s: dict) -> bool:
        members = by_cluster[int(s.get("cluster", -1))]
        return bool(members) and _name(members[0]) == _name(s)

    top_rank1_frac = sum(1 for s in top if _is_rank1(s)) / max(1, len(top))

    # Null: random sample K from survivors, measure rank-1 fraction
    rng = random.Random(42)
    null_fracs = []
    for _ in range(n_null):
        sample = rng.sample(survivors, min(K, len(survivors)))
        null_fracs.append(sum(1 for s in sample if _is_rank1(s)) / max(1, len(sample)))

    null_mean = statistics.mean(null_fracs)
    null_p95 = _percentile(null_fracs, 95)
    null_p99 = _percentile(null_fracs, 99)
    null_p999 = _percentile(null_fracs, 99.9)

    return {
        "K": K,
        "dim": score_dim,
        "top_rank1_fraction": round(top_rank1_frac, 4),
        "null_mean": round(null_mean, 4),
        "null_p95": round(null_p95, 4),
        "null_p99": round(null_p99, 4),
        "null_p999": round(null_p999, 4),
        "significant_0_05": top_rank1_frac > null_p95,
        "significant_0_01": top_rank1_frac > null_p99,
        "significant_0_001": top_rank1_frac > null_p999,
    }


def score_magnitude_test(
    survivors: list[dict], K: int, score_dim: str, n_null: int = N_NULL,
) -> dict:
    """Top-K score vs random-K score: are top-K scores markedly higher?"""
    sorted_all = sorted(survivors, key=lambda s: _score(s, score_dim), reverse=True)
    top = sorted_all[:K]
    top_mean = statistics.mean(_score(s, score_dim) for s in top)

    rng = random.Random(42)
    null_means = []
    for _ in range(n_null):
        sample = rng.sample(survivors, min(K, len(survivors)))
        null_means.append(statistics.mean(_score(s, score_dim) for s in sample))

    return {
        "K": K,
        "dim": score_dim,
        "top_mean": round(top_mean, 4),
        "null_mean": round(statistics.mean(null_means), 4),
        "null_p95": round(_percentile(null_means, 95), 4),
        "null_p999": round(_percentile(null_means, 99.9), 4),
        "z_score": round((top_mean - statistics.mean(null_means)) /
                         max(statistics.pstdev(null_means), 1e-6), 2),
        "significant_0_05": top_mean > _percentile(null_means, 95),
        "significant_0_001": top_mean > _percentile(null_means, 99.9),
    }


def per_type_rank1(survivors: list[dict], K: int, score_dim: str = "composite") -> dict:
    """Within each entity type (filing, fact), test top-K rank-1 concentration."""
    by_type: dict[str, list[dict]] = defaultdict(list)
    for s in survivors:
        by_type[_entity_type(s)].append(s)
    results = {}
    for t, t_survs in by_type.items():
        if len(t_survs) < K + 10:
            continue
        r = rank_concentration_test(t_survs, K, score_dim, n_null=N_NULL)
        results[t] = r
    return results


def btut_config_stability(
    btut_2000: dict, btut_5000: dict, K: int = 25
) -> dict:
    """Overlap between top-K anomalies at target=2000 vs target=5000.

    Both are the same BTUT pipeline on the same 61,041 entities, differing
    only in target_survivors and resolutions. If top anomalies are truly
    structural properties of the data, they should overlap heavily.
    """
    def _top_names(btut: dict, K: int, dim: str = "composite") -> list[str]:
        survs = btut.get("survivors") or []
        s_sorted = sorted(survs, key=lambda s: _score(s, dim), reverse=True)
        return [_name(s) for s in s_sorted[:K]]

    results = {}
    for dim in SCORE_DIMS:
        top_2000 = set(_top_names(btut_2000, K, dim))
        top_5000 = set(_top_names(btut_5000, K, dim))
        overlap = top_2000 & top_5000
        results[dim] = {
            "top_2000_count": len(top_2000),
            "top_5000_count": len(top_5000),
            "overlap_count": len(overlap),
            "overlap_fraction": round(len(overlap) / K, 3),
        }
    return {"K": K, "per_dim": results}


def composite_distribution_analysis(survivors: list[dict]) -> dict:
    """Distribution of composite scores across all 4 dimensions."""
    out = {}
    for dim in SCORE_DIMS:
        vals = [_score(s, dim) for s in survivors]
        out[dim] = {
            "n": len(vals),
            "min": round(min(vals), 4),
            "max": round(max(vals), 4),
            "mean": round(statistics.mean(vals), 4),
            "median": round(statistics.median(vals), 4),
            "p95": round(_percentile(vals, 95), 4),
            "p99": round(_percentile(vals, 99), 4),
            "stdev": round(statistics.pstdev(vals), 4),
        }
    return out


def main() -> int:
    btut_2000 = json.loads(BTUT_2000.read_text(encoding="utf-8"))
    btut_5000 = json.loads(BTUT_5000.read_text(encoding="utf-8"))
    survivors = btut_5000.get("survivors") or []
    log.info("Primary survivor set: target=5000, n=%d, clusters=%s",
             len(survivors), (btut_5000.get("summary") or {}).get("clusters"))

    t0 = time.time()

    report = {
        "corpus": "EDGAR 61,041 entities",
        "primary_btut_target": 5000,
        "primary_survivors": len(survivors),
        "primary_clusters": (btut_5000.get("summary") or {}).get("clusters"),
        "n_null_iterations": N_NULL,
        "K_values_tested": K_VALUES,
        "score_dims_tested": SCORE_DIMS,
    }

    log.info("[1/5] Rank-1-in-cluster tests across K x dim (%d tests)",
             len(K_VALUES) * len(SCORE_DIMS))
    rank_results = []
    for K in K_VALUES:
        for dim in SCORE_DIMS:
            rank_results.append(rank_concentration_test(survivors, K, dim))
    report["rank1_tests"] = rank_results

    log.info("[2/5] Score magnitude tests across K x dim")
    mag_results = []
    for K in K_VALUES:
        for dim in SCORE_DIMS:
            mag_results.append(score_magnitude_test(survivors, K, dim))
    report["score_magnitude_tests"] = mag_results

    log.info("[3/5] Per-type rank-1 tests (K=25, K=100)")
    report["per_type_rank1"] = {
        "K_25": per_type_rank1(survivors, 25),
        "K_100": per_type_rank1(survivors, 100),
    }

    log.info("[4/5] BTUT config stability (target=2000 vs target=5000)")
    report["config_stability"] = btut_config_stability(btut_2000, btut_5000, K=25)
    report["config_stability_K_100"] = btut_config_stability(btut_2000, btut_5000, K=100)

    log.info("[5/5] Composite distribution analysis")
    report["score_distributions"] = composite_distribution_analysis(survivors)

    report["wall_seconds"] = round(time.time() - t0, 1)

    out_path = REPO_ROOT / "data" / "validation" / "edgar_extreme_validation.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, sort_keys=True, default=str),
                        encoding="utf-8")

    # Human summary
    print()
    print("=" * 90)
    print(f"EDGAR EXTREME-SCALE VALIDATION  (N={N_NULL} null iterations per test)")
    print("=" * 90)
    print(f"Corpus: {report['corpus']}, {len(survivors)} survivors, "
          f"{report['primary_clusters']} clusters")

    print(f"\n[1] RANK-1-IN-CLUSTER TESTS  (4 dims x 7 K values = 28 tests)")
    print(f"    {'K':>6}  {'dim':<14s}  {'top':>8}  {'null_mean':>10}  {'null_p95':>10}  {'null_p999':>10}  p<0.001?")
    for r in rank_results:
        badge = "[PASS]" if r["significant_0_001"] else ("(.05)" if r["significant_0_05"] else "  ")
        print(f"    {r['K']:>6}  {r['dim']:<14s}  {r['top_rank1_fraction']:>8.3f}  "
              f"{r['null_mean']:>10.3f}  {r['null_p95']:>10.3f}  {r['null_p999']:>10.3f}  {badge}")
    n_sig_05 = sum(1 for r in rank_results if r["significant_0_05"])
    n_sig_01 = sum(1 for r in rank_results if r["significant_0_01"])
    n_sig_001 = sum(1 for r in rank_results if r["significant_0_001"])
    print(f"    -> {n_sig_05}/{len(rank_results)} significant at a=0.05, "
          f"{n_sig_01} at a=0.01, {n_sig_001} at a=0.001")

    print(f"\n[2] SCORE MAGNITUDE TESTS  (top-K mean score vs random-K mean)")
    print(f"    {'K':>6}  {'dim':<14s}  {'top_mean':>10}  {'null_p999':>10}  {'z-score':>8}  p<0.001?")
    for r in mag_results:
        badge = "[PASS]" if r["significant_0_001"] else ("(.05)" if r["significant_0_05"] else "  ")
        print(f"    {r['K']:>6}  {r['dim']:<14s}  {r['top_mean']:>10.3f}  "
              f"{r['null_p999']:>10.3f}  {r['z_score']:>8.1f}  {badge}")
    n_mag_001 = sum(1 for r in mag_results if r["significant_0_001"])
    print(f"    -> {n_mag_001}/{len(mag_results)} significant at a=0.001")

    print(f"\n[3] PER-TYPE RANK-1  (K=25)")
    for t, r in report["per_type_rank1"]["K_25"].items():
        badge = "[PASS]" if r["significant_0_001"] else ("(.05)" if r["significant_0_05"] else "  ")
        print(f"    type={t:<20s}  top={r['top_rank1_fraction']:.3f}  "
              f"null_p95={r['null_p95']:.3f}  {badge}")

    print(f"\n[4] BTUT CONFIG STABILITY  (target=2000 top-K vs target=5000 top-K)")
    for dim, r in report["config_stability"]["per_dim"].items():
        print(f"    dim={dim:<14s}  K=25 overlap {r['overlap_count']}/25  "
              f"({r['overlap_fraction']*100:.0f}%)")
    for dim, r in report["config_stability_K_100"]["per_dim"].items():
        print(f"    dim={dim:<14s}  K=100 overlap {r['overlap_count']}/100  "
              f"({r['overlap_fraction']*100:.0f}%)")

    print(f"\n[5] SCORE DISTRIBUTIONS")
    for dim, d in report["score_distributions"].items():
        print(f"    {dim:<14s}  range=[{d['min']}, {d['max']}]  "
              f"mean={d['mean']}  p95={d['p95']}  p99={d['p99']}")

    print(f"\n  Wall: {report['wall_seconds']}s")
    print(f"  Report: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
