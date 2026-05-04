"""Source operators — load corpus records into the pipeline state.

Source operators are the only operators allowed to do I/O against the
outside world (filesystem, HTTP). All downstream operators are pure
functions of their inputs.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import Operator, register


@register
class NDJSONSource(Operator):
    """Load any NDJSON corpus into a list of dict records.

    The shape of each record is corpus-specific; downstream operators
    (embedders, aligners) declare which fields they need. This operator
    is corpus-agnostic.

    config:
        path:        str — required, NDJSON file path (relative to repo root)
        target:      int — optional, take first N records (after stratification)
        stratify_by: str — optional, field name to stratify by when target<N
        text_field:  str — optional, field name for text body (default: text)
        label_field: str — optional, field name for coarse label (default: archive)
    """
    kind = "source.ndjson"
    stage = "source"

    def run(self, inputs, *, seed, config):
        path = Path(config["path"])
        text_field = config.get("text_field", "text")
        label_field = config.get("label_field", "archive")

        records = []
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
    out = []
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
