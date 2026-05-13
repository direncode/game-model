"""Tests for the BTUT-vs-Stratified IP boundary."""
from __future__ import annotations

import random
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.reduce import (  # noqa: E402
    BTUTReducer, StratifiedReducer, _deterministic_stratified_sample,
)


def _records(n: int, n_labels: int = 3) -> list[dict]:
    return [
        {"id": f"r{i}", "text": f"row {i}", "label": "ABCDE"[i % n_labels]}
        for i in range(n)
    ]


def test_stratified_hits_target() -> None:
    op = StratifiedReducer()
    out = op.run({"records": _records(600)}, seed=42,
                 config={"target_survivors": 90})
    assert out["n_records_out"] == 90
    assert out["backend"] == "stratified"


def test_stratified_is_deterministic() -> None:
    op = StratifiedReducer()
    recs = _records(600)
    a = op.run({"records": recs}, seed=42, config={"target_survivors": 60})
    b = op.run({"records": recs}, seed=42, config={"target_survivors": 60})
    assert [r["id"] for r in a["records"]] == [r["id"] for r in b["records"]]


def test_stratified_different_seeds_different_survivors() -> None:
    op = StratifiedReducer()
    recs = _records(600)
    a = op.run({"records": recs}, seed=42, config={"target_survivors": 60})
    b = op.run({"records": recs}, seed=43, config={"target_survivors": 60})
    assert sorted(r["id"] for r in a["records"]) != sorted(r["id"] for r in b["records"])


def test_stratified_passthrough_below_target() -> None:
    op = StratifiedReducer()
    out = op.run({"records": _records(50)}, seed=42,
                 config={"target_survivors": 300})
    assert out["n_records_out"] == 50


def test_stratified_label_distribution_roughly_proportional() -> None:
    op = StratifiedReducer()
    recs = _records(900, n_labels=3)
    out = op.run({"records": recs}, seed=42, config={"target_survivors": 150})
    counts: dict[str, int] = {}
    for r in out["records"]:
        counts[r["label"]] = counts.get(r["label"], 0) + 1
    for lbl in ("A", "B", "C"):
        assert 40 <= counts.get(lbl, 0) <= 60, counts


def test_btut_falls_back_to_stratified_without_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(sys.modules, "app.services.btut.pipeline", None)
    op = BTUTReducer()
    out = op.run({"records": _records(600)}, seed=42,
                 config={"target_survivors": 60})
    assert out["backend"] == "stratified"
    assert out["n_records_out"] == 60


def test_btut_fallback_matches_stratified_byte_for_byte(monkeypatch: pytest.MonkeyPatch) -> None:
    """IP boundary check: when BTUT falls back it must produce the SAME
    survivors the free-tier StratifiedReducer would have, so the two
    operators don't behave subtly differently in the same circumstances."""
    monkeypatch.setitem(sys.modules, "app.services.btut.pipeline", None)
    recs = _records(600)
    btut_out = BTUTReducer().run({"records": recs}, seed=42, config={"target_survivors": 60})
    strat_out = StratifiedReducer().run({"records": recs}, seed=42, config={"target_survivors": 60})
    assert [r["id"] for r in btut_out["records"]] == [r["id"] for r in strat_out["records"]]


def test_btut_class_in_both_strip_lists() -> None:
    """If someone renames BTUTReducer without updating both vendor_strip
    targets, the trade-secret bytes leak. Pin both ends here."""
    cli_strip = (REPO_ROOT / "packages/ocean-cli/scripts/vendor_strip.py").read_text()
    assert "BTUTReducer" in cli_strip, "BTUTReducer must be in cli vendor_strip"
    mcp_strip = (REPO_ROOT / "packages/ocean-mcp/scripts/vendor_strip.py").read_text()
    assert "BTUTReducer" in mcp_strip, "BTUTReducer must be in mcp vendor_strip"


def test_stratified_helper_order_independent() -> None:
    """Content-addressed stratifier: shuffling input doesn't change output."""
    recs = _records(300)
    a = _deterministic_stratified_sample(records=recs, label_field="label", target=30, seed=42)
    shuffled = recs[:]
    random.Random(7).shuffle(shuffled)
    b = _deterministic_stratified_sample(records=shuffled, label_field="label", target=30, seed=42)
    assert sorted(r["id"] for r in a) == sorted(r["id"] for r in b)
