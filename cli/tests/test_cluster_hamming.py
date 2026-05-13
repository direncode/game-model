"""Tests for the cluster.hamming operator (free-tier; ships in wheel)."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.cluster import HammingClusterer  # noqa: E402


def _fps(values: list[int]) -> np.ndarray:
    return np.array(values, dtype=np.uint64)


def test_identical_fingerprints_collapse_into_one_module() -> None:
    op = HammingClusterer()
    fps = _fps([0xABCDEF, 0xABCDEF, 0xABCDEF])
    out = op.run({"fp48s": fps}, seed=42, config={"threshold": 0})
    assert out["modules_active_final"] == 1


def test_far_apart_fingerprints_form_distinct_modules() -> None:
    op = HammingClusterer()
    fps = _fps([
        0x000000000000FFFF, 0x000000000000FFFF, 0x000000000000FFFF,
        0xFFFFFFFFFFFFFFFF, 0xFFFFFFFFFFFFFFFF, 0xFFFFFFFFFFFFFFFF,
    ])
    out = op.run({"fp48s": fps}, seed=42, config={"threshold": 8})
    assert out["modules_active_final"] == 2


def test_threshold_governs_membership() -> None:
    op = HammingClusterer()
    fps = _fps([0xF0, 0xFF, 0xF0, 0xFF])  # differ in 4 bits
    out_close = op.run({"fp48s": fps}, seed=42, config={"threshold": 8})
    out_strict = op.run({"fp48s": fps}, seed=42, config={"threshold": 2})
    assert out_close["modules_active_final"] == 1
    assert out_strict["modules_active_final"] == 2


def test_hamming_is_deterministic_at_seed() -> None:
    op = HammingClusterer()
    rng = np.random.RandomState(7)
    fps = rng.randint(0, 2 ** 48, size=50, dtype=np.uint64)
    a = op.run({"fp48s": fps}, seed=42, config={"threshold": 12})
    b = op.run({"fp48s": fps}, seed=42, config={"threshold": 12})
    assert [m["centroid_stats"]["n_members"] for m in a["modules"]] == [
        m["centroid_stats"]["n_members"] for m in b["modules"]
    ]


def test_module_budget_enforced() -> None:
    op = HammingClusterer()
    rng = np.random.RandomState(3)
    fps = rng.randint(0, 2 ** 48, size=30, dtype=np.uint64)
    out = op.run(
        {"fp48s": fps},
        seed=42,
        config={"threshold": 0, "max_modules": 5},
    )
    assert out["modules_active_final"] <= 5


def test_missing_fp48s_raises() -> None:
    op = HammingClusterer()
    with pytest.raises(ValueError, match="fp48s"):
        op.run({}, seed=42, config={})


def test_centroid_is_bitwise_majority() -> None:
    op = HammingClusterer()
    fp = 0xDEADBEEFDEAD
    out = op.run({"fp48s": _fps([fp, fp, fp])}, seed=42, config={"threshold": 0})
    assert out["modules"][0]["centroid_fp48"] == fp
