"""Shared analyze primitives for Latent Ocean public showcases.

Imported by scripts/arxiv_analyze.py and scripts/pulse_analyze.py.
Pure functions, stdlib only. No IO. No sklearn. No external services.

Coverage decision: docsouth_analyze.py is NOT migrated to this library
in v1. Atlas + Pulse use it; DocSouth's analyze script keeps its own
copies. Migration is opt-in if useful later.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Any


def hamming48(a: int, b: int) -> int:
    x = a ^ b
    c = 0
    while x:
        x &= x - 1
        c += 1
    return c


def weighted_purity(labels: list, golds: list) -> tuple[float, list[dict]]:
    """For each cluster, take the share of records whose gold label is the
    cluster's plurality label; weight by cluster size; sum.
    """
    by_cluster: dict[Any, Counter] = defaultdict(Counter)
    for lab, g in zip(labels, golds):
        by_cluster[lab][g] += 1
    rows: list[dict] = []
    weighted = 0
    total = 0
    for cid, ctr in by_cluster.items():
        size = sum(ctr.values())
        if size == 0:
            continue
        dom_label, dom_n = max(ctr.items(), key=lambda x: x[1])
        rows.append({
            "cluster":         cid,
            "size":            size,
            "dominant":        dom_label,
            "dominant_share": round(dom_n / size, 3),
            "breakdown":       dict(ctr),
        })
        weighted += dom_n
        total += size
    rows.sort(key=lambda x: -x["size"])
    return (round(weighted / total, 3) if total else 0.0, rows)


def category_entropy(items: list) -> float:
    """Shannon entropy of a multiset of items."""
    if not items:
        return 0.0
    counts = Counter(items)
    n = len(items)
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    return h


def decade_of(year: int) -> str:
    if year < 1990:
        return "pre-1990s"
    return f"{(year // 10) * 10}s"


def assign_to_class(fp48: int, classes: list[dict]) -> int | None:
    """Return the class_id whose centroid has the smallest Hamming distance to fp48."""
    best_id, best_d = None, 49
    for c in classes:
        d = hamming48(fp48, c["centroid_fp48"])
        if d < best_d:
            best_d, best_id = d, c["id"]
    return best_id


def top_rare(survivors: list[dict], k: int = 25) -> list[dict]:
    """Rank survivors by their min-Hamming-distance to any other survivor (descending).
    Returns shape-agnostic dicts with min_hamming added; caller is responsible for
    picking the domain-specific fields they want.
    """
    fps = [s["fp48"] for s in survivors]
    rarities: list[tuple[int, int]] = []
    for i, fp_i in enumerate(fps):
        best = 49
        for j, fp_j in enumerate(fps):
            if i == j:
                continue
            d = hamming48(fp_i, fp_j)
            if d < best:
                best = d
        rarities.append((i, best))
    rarities.sort(key=lambda x: -x[1])
    return [
        {**survivors[i], "min_hamming": dist}
        for i, dist in rarities[:k]
    ]


def bleed_per_class(
    survivors: list[dict], classes: list[dict], gold_field: str = "archive",
) -> list[dict]:
    """For each cluster, identify the dominant gold-label and the off-label bleed.

    `gold_field` parameterizes which survivor field to use as the gold label
    (Atlas: 'archive'; Pulse: 'patentsview_inventor_id' or 'primary_ipc').
    """
    by_class: dict[Any, list[dict]] = defaultdict(list)
    for s in survivors:
        cid = assign_to_class(s["fp48"], classes)
        if cid is not None:
            by_class[cid].append(s)
    rows: list[dict] = []
    for cid, ss in by_class.items():
        if not ss:
            continue
        labels = Counter(s.get(gold_field, "") for s in ss)
        dom_label, dom_n = labels.most_common(1)[0]
        bleed = [s for s in ss if s.get(gold_field, "") != dom_label]
        bleed_breakdown = Counter(s.get(gold_field, "") for s in bleed)
        rows.append({
            "class_id":        cid,
            "size":            len(ss),
            "dominant":        dom_label,
            "dominant_share":  round(dom_n / len(ss), 3),
            "bleed_share":     round(len(bleed) / len(ss), 3),
            "bleed_breakdown": dict(bleed_breakdown),
        })
    rows.sort(key=lambda x: -x["size"])
    return rows


def flag_emergence_candidates(
    cluster_meta: list[dict],
    *,
    min_median_year: int,
    max_year_spread: int,
    min_category_entropy: float,
) -> list[dict]:
    """Filter cluster_meta for clusters that are young + tight + diverse."""
    return [
        c for c in cluster_meta
        if c.get("median_year", 0) >= min_median_year
        and c.get("year_spread", 999) <= max_year_spread
        and c.get("category_entropy", 0.0) >= min_category_entropy
    ]


def stride_sample(items: list, target: int) -> list:
    """Deterministic stride sample to exactly `target` items.

    items is assumed pre-sorted by the caller. When len > target,
    pick evenly-spaced indices: items[int(i * len/target)] for i in [0, target).
    No RNG -- same input + same target -> byte-identical output.
    """
    if target <= 0 or len(items) <= target:
        return list(items)
    step = len(items) / target
    return [items[int(i * step)] for i in range(target)]
