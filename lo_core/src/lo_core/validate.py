"""Falsification harness for Findings.

Two tests, both decisive:

1. NULL PERMUTATION — cross-legend fingerprint shuffle + role-label
   shuffle + within-legend entity-name shuffle. Preserves distributions,
   destroys entity/role/fingerprint assignments. True signal should
   NOT replicate in null runs.

2. HOLD-OUT SPLIT — derive density threshold from N-k legends, apply
   across all N. Tests whether the cutoff generalizes.

Every shipped finding should pass the null at α=0.05 (one-sided).
"""
from __future__ import annotations

import math
import random
import statistics
from collections import Counter

from lo_core.analyze import (
    DEFAULT_PARADIGM_ROLES,
    compute_bridges,
    convergent_clusters,
    cross_era_anchors,
    extract_fingerprints,
    global_fingerprint_count,
    paradigm_distribution,
    triple_bridges,
)
from lo_core.schemas import HoldoutResult, NullTestResult, ValidationReport


def _percentile(vals: list[float], p: float) -> float:
    if not vals:
        return 0.0
    s = sorted(vals)
    k = (p / 100.0) * (len(s) - 1)
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return s[lo]
    frac = k - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def _shuffle_fps_across(
    legend_fps: dict[str, dict[str, str]], rng: random.Random,
) -> dict[str, dict[str, str]]:
    all_fps: list[str] = []
    counts: dict[str, int] = {}
    for lid, fps in legend_fps.items():
        all_fps.extend(fps.values())
        counts[lid] = len(fps)
    rng.shuffle(all_fps)
    out: dict[str, dict[str, str]] = {}
    idx = 0
    for lid, fps in legend_fps.items():
        names = list(fps.keys())
        n = counts[lid]
        out[lid] = dict(zip(names, all_fps[idx : idx + n]))
        idx += n
    return out


def _shuffle_survivors_within(
    survivors_by_corpus: dict[str, list[dict]], rng: random.Random,
) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for cid, survs in survivors_by_corpus.items():
        names = [((s.get("entity") or {}).get("name")) or "" for s in survs]
        rng.shuffle(names)
        out[cid] = [
            {**s, "entity": {**(s.get("entity") or {}), "name": names[i]}}
            for i, s in enumerate(survs)
        ]
    return out


def _shuffle_role_map(
    role_map: dict[str, dict[str, str]], rng: random.Random,
) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for corpus, subs in role_map.items():
        names = list(subs.keys())
        roles = list(subs.values())
        rng.shuffle(roles)
        out[corpus] = dict(zip(names, roles))
    return out


def _metrics_for_run(
    survivors_by_corpus: dict[str, list[dict]],
    fingerprints: dict[str, dict[str, str]],
    role_map: dict[str, dict[str, str]],
    focus_corpus: str,
) -> dict:
    gfc = global_fingerprint_count(fingerprints)
    bridges, bridge_stats = compute_bridges(fingerprints)
    triples = triple_bridges(fingerprints, gfc)

    top_w = bridges[0]["weighted_score"] if bridges else 0.0
    n_pairs_possible = (len(fingerprints) * (len(fingerprints) - 1)) // 2

    focus_survs = survivors_by_corpus.get(focus_corpus, [])
    paradigm = paradigm_distribution(focus_survs, role_map=role_map)
    confirmed: dict[str, bool] = {
        c: bool(h.get("confirmed", False))
        for c, h in paradigm.get("hypothesis_by_corpus", {}).items()
    }
    clusters = convergent_clusters(focus_survs)
    top_hot = clusters[0].hot_count if clusters else 0
    eras = cross_era_anchors(focus_survs)

    return {
        "pairwise_bridges": len(bridges),
        "triple_bridges": len(triples),
        "top_bridge_weighted": round(top_w, 4),
        "frac_legend_pairs_with_bridge": round(
            len(bridges) / max(1, n_pairs_possible), 4
        ),
        "focus_hypothesis_newton": confirmed.get("newton", False),
        "focus_hypothesis_leonardo": confirmed.get("leonardo", False),
        "focus_hypothesis_vn": confirmed.get("vn", False),
        "focus_top_convergent_cluster_hot_count": top_hot,
        "focus_n_cross_era_anchors": len(eras),
        "dense_fingerprints_dropped": bridge_stats.get("dense_fingerprints_dropped", 0),
        "unique_fingerprints_total": bridge_stats.get("total_unique_fingerprints", 0),
    }


_HIGHER_IS_SIGNAL = {
    "pairwise_bridges": True,
    "triple_bridges": True,
    "top_bridge_weighted": True,
    "frac_legend_pairs_with_bridge": True,
    "focus_hypothesis_newton": True,
    "focus_hypothesis_leonardo": True,
    "focus_hypothesis_vn": True,
    "focus_top_convergent_cluster_hot_count": True,
    "focus_n_cross_era_anchors": True,
    "dense_fingerprints_dropped": False,
    "unique_fingerprints_total": True,
}


def _compare(metric: str, true_val, null_vals: list) -> NullTestResult:
    higher_is_signal = _HIGHER_IS_SIGNAL.get(metric, True)
    numeric_nulls = [v for v in null_vals if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if numeric_nulls:
        mean = statistics.mean(numeric_nulls)
        p05 = _percentile(numeric_nulls, 5)
        p95 = _percentile(numeric_nulls, 95)
        if higher_is_signal:
            sig = float(true_val) > p95
        else:
            sig = float(true_val) < p05
        return NullTestResult(
            metric=metric,
            true_value=float(true_val),
            null_mean=round(mean, 4),
            null_std=round(statistics.pstdev(numeric_nulls), 4) if len(numeric_nulls) > 1 else 0.0,
            null_p05=round(p05, 4),
            null_p95=round(p95, 4),
            significant_at_0_05=sig,
        )
    # Boolean case
    prop = sum(1 for v in null_vals if v) / max(1, len(null_vals))
    return NullTestResult(
        metric=metric,
        true_value=bool(true_val),
        null_proportion_true=round(prop, 3),
        significant_at_0_05=(bool(true_val) and prop < 0.05),
    )


def validate_corpora(
    survivors_by_corpus: dict[str, list[dict]],
    focus_corpus: str,
    n_iterations: int = 30,
    seed: int = 42,
    held_out: tuple[str, ...] | None = None,
    role_map: dict[str, dict[str, str]] | None = None,
) -> ValidationReport:
    """Run null permutation + hold-out validation against a multi-corpus set."""
    roles = role_map if role_map is not None else DEFAULT_PARADIGM_ROLES

    fingerprints = {cid: extract_fingerprints(survs)
                    for cid, survs in survivors_by_corpus.items()}

    true_metrics = _metrics_for_run(
        survivors_by_corpus, fingerprints, roles, focus_corpus,
    )

    rng = random.Random(seed)
    null_metrics_list: list[dict] = []
    for _ in range(n_iterations):
        shuf_fps = _shuffle_fps_across(fingerprints, rng)
        shuf_survs = _shuffle_survivors_within(survivors_by_corpus, rng)
        shuf_roles = _shuffle_role_map(roles, rng)
        null_metrics_list.append(_metrics_for_run(
            shuf_survs, shuf_fps, shuf_roles, focus_corpus,
        ))

    null_tests: list[NullTestResult] = []
    for metric in true_metrics:
        null_vals = [m[metric] for m in null_metrics_list]
        null_tests.append(_compare(metric, true_metrics[metric], null_vals))

    holdout = None
    if held_out:
        holdout = _run_holdout(survivors_by_corpus, fingerprints, held_out)

    notes = [
        "Null N={} iterations. Strong null: cross-legend fp shuffle + "
        "within-legend survivor shuffle + role-label shuffle.".format(n_iterations),
        "Significance: true metric outside null's 95th percentile (one-sided, alpha=0.05).",
    ]
    return ValidationReport(
        n_iterations=n_iterations,
        seed=seed,
        null_tests=null_tests,
        holdout=holdout,
        notes=notes,
    )


def _run_holdout(
    survivors_by_corpus: dict[str, list[dict]],
    fingerprints: dict[str, dict[str, str]],
    held_out: tuple[str, ...],
) -> HoldoutResult:
    train_fps = {k: v for k, v in fingerprints.items() if k not in held_out}
    train_bridges, _ = compute_bridges(train_fps)
    full_bridges, _ = compute_bridges(fingerprints)

    held_set = set(held_out)
    held_bridges = [
        b for b in full_bridges if (b["a"] in held_set) or (b["b"] in held_set)
    ]

    return HoldoutResult(
        held_out=list(held_out),
        train_bridge_count=len(train_bridges),
        full_bridge_count=len(full_bridges),
        bridges_involving_heldout=len(held_bridges),
        top_heldout_bridge=(
            {"a": held_bridges[0]["a"], "b": held_bridges[0]["b"],
             "weighted_score": held_bridges[0]["weighted_score"]}
            if held_bridges else None
        ),
    )
