"""Reduce operators — large record sets → small, representative survivors.

Two operators live here, on opposite sides of the open-core / proprietary
boundary. Keep this boundary clean — IP discipline matters more than DRY:

* ``reduce.btut`` (PROPRIETARY) wraps the full backend pipeline
  (``app.services.btut.pipeline.run_btut_pipeline``): pre-filter →
  embed → JL projection to 8-D → multi-resolution lattice threading →
  3-axis scoring → stratified selection. Listed in
  ``vendor_strip.PROPRIETARY_CLASSES`` so it is removed from the
  open-core wheel before publication. Open-core users who write
  ``reduce using btut`` get a clear error pointing at the hosted API
  or at the free-tier substitute (``using stratified``).

* ``reduce.stratified`` (FREE-TIER) does a deterministic stratified
  sample by the corpus's label field. Generic technique, no IP, no
  backend dependencies. Ships in the open-core wheel. Useful as a
  baseline reducer and as the local fallback when BTUT isn't available.

Both classes share the IO contract so OCEAN programs can swap between
them by changing only the ``using <variant>`` clause:

    reduce using btut         → reduce.btut         (premium)
    reduce using stratified   → reduce.stratified   (free)
"""
from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from typing import Any

from . import Operator, register


# ── Shared deterministic stratified sampler ──────────────────────────────

def _deterministic_stratified_sample(
    *,
    records: list[dict],
    label_field: str,
    target: int,
    seed: int,
) -> list[dict]:
    """Quota-by-label, ordered by stable hash of (seed, record-content).

    Each label gets a quota proportional to its frequency, with a floor
    of one record per label. Within a stratum the records are ranked
    by ``sha256(seed || canonical-json(record))`` — content-addressed,
    not position-addressed — so reshuffling the input list does NOT
    change the survivor set. ``(records-as-set, target, seed)`` is the
    only signal; insertion order is irrelevant.

    Determinism contract pinned in ``cli/tests/test_reduce_split.py``.
    """
    import json
    if target >= len(records):
        return list(records)

    labels = [str(r.get(label_field, "?")) for r in records]
    freq = Counter(labels)
    total = sum(freq.values())

    quotas: dict[str, int] = {
        lbl: max(1, round(n / total * target))
        for lbl, n in freq.items()
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
                + json.dumps(records[i], sort_keys=True, default=str).encode()
            ).hexdigest(),
        )
        for j in scored[:quota]:
            survivors.append(records[j])
    return survivors


# ── Free-tier stratified reducer ─────────────────────────────────────────

@register
class StratifiedReducer(Operator):
    """Deterministic stratified sample by label. Free-tier.

    Open-core users get this locally without an API key. It will NOT
    produce the same survivor set as BTUT — stratified is a baseline
    sampler, BTUT is a multi-tier topological reducer — but the OCEAN
    contract (records-in, records-out, same SHA on re-run) holds.

    Inputs (from upstream `load`):
        records:     list[dict]   — the corpus rows
        label_field: str          — optional, defaults to corpus manifest

    Config:
        target_survivors: int  — how many records to retain (default 300)

    Outputs:
        records:         list[dict]
        n_records_in:    int
        n_records_out:   int
        reduction_ratio: float
        backend:         str   — always "stratified"
        label_field:     str   — passed through
    """
    kind = "reduce.stratified"
    stage = "reduce"

    def run(self, inputs, *, seed, config):
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


# ── Proprietary BTUT reducer ─────────────────────────────────────────────
# IMPORTANT: This class is listed in ``packages/ocean-cli/scripts/
# vendor_strip.PROPRIETARY_CLASSES``. The vendor-strip script removes it
# from the open-core wheel's vendored tree before publication. Do NOT
# move the proprietary logic out of this class; doing so would defeat
# the strip.

@register
class BTUTReducer(Operator):
    """Bottom-up tier-up reduction. PROPRIETARY — stripped from wheel.

    Wraps the heavy backend pipeline:
        PreFilter → Embed → JL-project to 8D → Multi-Resolution Lattice
        Threading → 3-Axis Scoring → Stratified Selection.

    If the backend pipeline can't be imported (e.g. running in the open-
    core source tree without the backend extras), this operator falls
    back to the SAME deterministic stratified sampler the free-tier
    ``reduce.stratified`` operator uses. That keeps the operator usable
    in the source tree while preserving the IP boundary: the proprietary
    code path is the lattice-threading one, the fallback is generic.

    Inputs / outputs / config: same shape as StratifiedReducer.
    """
    kind = "reduce.btut"
    stage = "reduce"

    def run(self, inputs, *, seed, config):
        records = inputs["records"]
        label_field = inputs.get("label_field") or config.get("label_field", "label")
        target = int(config.get("target_survivors", 300))
        target = max(1, min(target, len(records)))

        if len(records) <= target:
            return {
                "records":         records,
                "n_records_in":    len(records),
                "n_records_out":   len(records),
                "reduction_ratio": 1.0,
                "backend":         "passthrough",
                "label_field":     label_field,
            }

        survivors, backend = self._try_backend(
            records=records,
            label_field=label_field,
            target=target,
            seed=seed,
            edges=config.get("edges", []),
        )
        if survivors is None:
            survivors = _deterministic_stratified_sample(
                records=records,
                label_field=label_field,
                target=target,
                seed=seed,
            )
            backend = "stratified"

        return {
            "records":         survivors,
            "n_records_in":    len(records),
            "n_records_out":   len(survivors),
            "reduction_ratio": round(len(records) / max(1, len(survivors)), 3),
            "backend":         backend,
            "label_field":     label_field,
        }

    @staticmethod
    def _try_backend(
        *,
        records: list[dict],
        label_field: str,
        target: int,
        seed: int,
        edges: list,
    ) -> tuple[list[dict] | None, str]:
        try:
            from app.services.btut.pipeline import run_btut_pipeline  # type: ignore
        except Exception:
            return None, ""
        try:
            unique_types = sorted({str(r.get(label_field, "?")) for r in records})
            result = run_btut_pipeline(
                entities=records,
                edges=edges,
                unique_types=unique_types,
                target_survivors=target,
            )
        except Exception:
            return None, ""
        if isinstance(result, dict):
            survivors = result.get("survivors") or result.get("records")
        else:
            survivors = result
        if not isinstance(survivors, list) or not survivors:
            return None, ""
        return survivors, "btut"
