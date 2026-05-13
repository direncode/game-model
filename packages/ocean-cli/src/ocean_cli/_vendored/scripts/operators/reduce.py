"""Reduce operators — free-tier (cli-vendored).

This file ships in the ``lo-cli`` wheel. The proprietary ``BTUTReducer``
is stripped by ``packages/ocean-cli/scripts/vendor_strip.py``; only the
free-tier ``StratifiedReducer`` plus a friendly premium stub remain.

Open-core users who write ``reduce using btut`` hit the stub and get a
clear "premium operator" error pointing at the hosted API or the
``using stratified`` substitute.
"""
from __future__ import annotations

import hashlib
import json as _json
from collections import Counter, defaultdict
from typing import Any


def _deterministic_stratified_sample(
    *,
    records: list[dict],
    label_field: str,
    target: int,
    seed: int,
) -> list[dict]:
    """Quota-by-label, content-addressed within each stratum.

    Survivors depend on the SET of records (not list position) and the
    seed. Shuffling the input never changes the output. See the source
    copy in ``scripts/operators/reduce.py`` for the full rationale.
    """
    if target >= len(records):
        return list(records)

    labels = [str(r.get(label_field, "?")) for r in records]
    freq = Counter(labels)
    total = sum(freq.values())

    quotas: dict[str, int] = {
        lbl: max(1, round(n / total * target)) for lbl, n in freq.items()
    }
    while sum(quotas.values()) > target:
        heaviest = max(quotas, key=quotas.get)
        if quotas[heaviest] <= 1:
            break
        quotas[heaviest] -= 1
    while sum(quotas.values()) < target:
        heaviest = max(quotas, key=quotas.get)
        quotas[heaviest] += 1

    buckets: dict[str, list[int]] = defaultdict(list)
    for idx, lbl in enumerate(labels):
        buckets[lbl].append(idx)

    survivors: list[dict] = []
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


class StratifiedReducer:
    """Deterministic stratified sample by label. Free-tier reducer.

    config:
        target_survivors: int — retain this many records (default 300)
    """

    kind = "reduce.stratified"
    stage = "reduce"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        config = config or {}
        records = inputs["records"]
        label_field = inputs.get("label_field") or config.get("label_field", "label")
        target = int(config.get("target_survivors", 300))
        target = max(1, min(target, len(records)))

        survivors = _deterministic_stratified_sample(
            records=records,
            label_field=label_field,
            target=target,
            seed=seed,
        )
        return {
            "records":         survivors,
            "n_records_in":    len(records),
            "n_records_out":   len(survivors),
            "reduction_ratio": round(len(records) / max(1, len(survivors)), 3),
            "backend":         "stratified",
            "label_field":     label_field,
        }


class _BTUTPremiumStub:
    """Stub for ``reduce.btut`` in the open-core wheel. The real
    implementation is stripped during the wheel build. Raises with a
    clear directive to the hosted API or the stratified substitute."""

    kind = "reduce.btut"
    stage = "reduce"
    tier = "premium"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        raise RuntimeError(
            "reduce.btut is a premium operator and not available in this "
            "open-core build. Either:\n"
            "  • Set OCEAN_API_KEY and route to api.latentocean.com, or\n"
            "  • Use `reduce using stratified` for a deterministic "
            "free-tier substitute that preserves the OCEAN contract."
        )


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "reduce.stratified": StratifiedReducer(),
    "reduce.btut":       _BTUTPremiumStub(),
}


def get(name: str):
    return _REGISTRY.get(name)
