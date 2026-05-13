"""Tests for the reduce.btut operator's deterministic fallback.

The heavy backend (``app.services.btut.pipeline``) may not be importable
in every environment — that's the whole point of the fallback. These
tests pin the fallback's behaviour:

* Reduction respects the target-survivors count.
* Repeated calls with the same (records, seed) produce byte-identical
  survivors.
* Per-label proportions stay roughly stable under stratification.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.reduce import BTUTReducer  # noqa: E402


def _records(n: int) -> list[dict]:
    """Build a synthetic corpus with three labels A/B/C."""
    return [
        {"id": f"r{i}", "text": f"row {i}", "label": "ABC"[i % 3]}
        for i in range(n)
    ]


def test_passthrough_when_input_below_target() -> None:
    op = BTUTReducer()
    recs = _records(50)
    out = op.run({"records": recs}, seed=42, config={"target_survivors": 300})
    assert out["backend"] == "passthrough"
    assert out["n_records_out"] == 50
    assert out["reduction_ratio"] == 1.0


def test_stratified_fallback_hits_target(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force the backend import to fail so we land in the stratified path."""
    monkeypatch.setitem(sys.modules, "app.services.btut.pipeline", None)
    op = BTUTReducer()
    recs = _records(900)
    out = op.run({"records": recs}, seed=42, config={"target_survivors": 90})
    assert out["backend"] == "stratified"
    assert out["n_records_out"] == 90


def test_stratified_fallback_is_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(sys.modules, "app.services.btut.pipeline", None)
    op = BTUTReducer()
    recs = _records(600)
    a = op.run({"records": recs}, seed=42, config={"target_survivors": 60})
    b = op.run({"records": recs}, seed=42, config={"target_survivors": 60})
    a_ids = [r["id"] for r in a["records"]]
    b_ids = [r["id"] for r in b["records"]]
    assert a_ids == b_ids


def test_different_seeds_produce_different_survivors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(sys.modules, "app.services.btut.pipeline", None)
    op = BTUTReducer()
    recs = _records(600)
    a = op.run({"records": recs}, seed=42, config={"target_survivors": 60})
    b = op.run({"records": recs}, seed=43, config={"target_survivors": 60})
    a_ids = sorted(r["id"] for r in a["records"])
    b_ids = sorted(r["id"] for r in b["records"])
    assert a_ids != b_ids, "seed 42 and 43 must produce different survivor sets"


def test_stratified_preserves_label_distribution(monkeypatch: pytest.MonkeyPatch) -> None:
    """Per-label quotas should be roughly proportional to input frequency."""
    monkeypatch.setitem(sys.modules, "app.services.btut.pipeline", None)
    op = BTUTReducer()
    recs = _records(900)  # 300 each of A, B, C
    out = op.run({"records": recs}, seed=42, config={"target_survivors": 150})
    label_counts: dict[str, int] = {}
    for r in out["records"]:
        label_counts[r["label"]] = label_counts.get(r["label"], 0) + 1
    # Each label should land roughly 50 (±10).
    for lbl in ("A", "B", "C"):
        assert 40 <= label_counts.get(lbl, 0) <= 60, label_counts
