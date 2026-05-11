"""Free-tier source operators — load corpus records from disk.

Source operators are the only operators allowed to do I/O against the
outside world; everything downstream is a pure function of its inputs.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class NDJSONSource:
    """Load any NDJSON corpus into a list of dict records.

    config:
        path:        str — required, NDJSON file path
        target:      int — optional, take first N records (after stratification)
        stratify_by: str — optional, field name to stratify by when target<N
        text_field:  str — optional, field name for text body (default: text)
        label_field: str — optional, field name for coarse label (default: archive)
    """

    kind = "source.ndjson"
    stage = "source"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42,
            config: dict | None = None) -> dict[str, Any]:
        config = config or {}
        path = Path(config["path"])
        text_field = config.get("text_field", "text")
        label_field = config.get("label_field", "archive")

        records: list[dict] = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        target = config.get("target")
        stratify = config.get("stratify_by")
        if target and target < len(records):
            if stratify:
                records = _stratified_sample(records, target, stratify, seed)
            else:
                records = records[:target]

        return {
            "records":     records,
            "n":           len(records),
            "text_field":  text_field,
            "label_field": label_field,
        }


def _stratified_sample(records, target, key, seed):
    """Round-robin across distinct values of `key` to balance the sample."""
    import numpy as np
    from collections import defaultdict
    by_key: dict[str, list] = defaultdict(list)
    for r in records:
        by_key[r.get(key, "?")].append(r)
    rng = np.random.default_rng(seed)
    for k in by_key:
        rng.shuffle(by_key[k])
    keys = sorted(by_key.keys())
    out: list = []
    idx = 0
    while len(out) < target:
        progressed = False
        for k in keys:
            if idx < len(by_key[k]):
                out.append(by_key[k][idx])
                progressed = True
                if len(out) >= target:
                    break
        if not progressed:
            break
        idx += 1
    return out


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "source.ndjson": NDJSONSource(),
}


def get(name: str):
    return _REGISTRY.get(name)
