# ─────────────────────────────────────────────────────────
# This file ships in ocean-mcp on PyPI / npm.
# Premium operator implementations have been stripped from
# this build and replaced with stubs in ocean_mcp._premium_stubs.
# Premium operators run only on api.latentocean.com.
# Stripped classes from this file: BTUTReducer
# ─────────────────────────────────────────────────────────

"""Reduce operators — free-tier (mcp-vendored shape).

The mcp-vendored tree is regenerated from ``scripts/operators/`` on
every wheel build by ``packages/ocean-mcp/scripts/vendor_strip.py``,
which AST-removes ``BTUTReducer`` per the PROPRIETARY map. This file
is the post-strip artifact: only the free-tier ``StratifiedReducer``
plus a stub for ``reduce.btut`` that raises a legible "premium" error.
"""
from __future__ import annotations

import hashlib
import json as _json
from collections import Counter, defaultdict
from typing import Any

from . import Operator, register


def _deterministic_stratified_sample(*, records, label_field, target, seed):
    if target >= len(records):
        return list(records)
    labels = [str(r.get(label_field, "?")) for r in records]
    freq = Counter(labels)
    total = sum(freq.values())
    quotas = {lbl: max(1, round(n / total * target)) for lbl, n in freq.items()}
    while sum(quotas.values()) > target:
        heaviest = max(quotas, key=quotas.get)
        if quotas[heaviest] <= 1:
            break
        quotas[heaviest] -= 1
    while sum(quotas.values()) < target:
        heaviest = max(quotas, key=quotas.get)
        quotas[heaviest] += 1
    buckets = defaultdict(list)
    for idx, lbl in enumerate(labels):
        buckets[lbl].append(idx)
    survivors = []
    for lbl in sorted(buckets.keys()):
        idxs = buckets[lbl]
        quota = quotas.get(lbl, 0)
        if quota <= 0:
            continue
        scored = sorted(
            idxs,
            key=lambda i: hashlib.sha256(
                f"{seed}|".encode()
                + _json.dumps(records[i], sort_keys=True, default=str).encode()
            ).hexdigest(),
        )
        for j in scored[:quota]:
            survivors.append(records[j])
    return survivors


@register
class StratifiedReducer(Operator):
    """Deterministic stratified sample by label. Free-tier reducer."""
    kind = "reduce.stratified"
    stage = "reduce"

    def run(self, inputs, *, seed, config):
        records = inputs["records"]
        label_field = inputs.get("label_field") or config.get("label_field", "label")
        target = int(config.get("target_survivors", 300))
        target = max(1, min(target, len(records)))
        survivors = _deterministic_stratified_sample(
            records=records, label_field=label_field, target=target, seed=seed,
        )
        return {
            "records":         survivors,
            "n_records_in":    len(records),
            "n_records_out":   len(survivors),
            "reduction_ratio": round(len(records) / max(1, len(survivors)), 3),
            "backend":         "stratified",
            "label_field":     label_field,
        }


@register
class _BTUTPremiumStub(Operator):
    """Stub for ``reduce.btut``. The real implementation is stripped from
    the open-core wheel by vendor_strip. Calling ``run`` raises with a
    direction to the hosted API or the stratified substitute."""
    kind = "reduce.btut"
    stage = "reduce"

    def run(self, inputs, *, seed, config):
        raise RuntimeError(
            "reduce.btut is a premium operator and not available in this "
            "open-core build. Either route via api.latentocean.com (set "
            "OCEAN_API_KEY) or use `reduce using stratified` for a "
            "deterministic free-tier substitute."
        )
