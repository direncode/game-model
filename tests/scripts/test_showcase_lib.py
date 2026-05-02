"""Tests for scripts/_showcase_lib.py - shared analyze primitives.

These tests cover the library directly (no Atlas-specific or Pulse-specific
assumptions). The Atlas test suite covers the same primitives indirectly
through arxiv_analyze.py wrappers; these tests are the direct contract.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import _showcase_lib as lib  # noqa: E402


# --- hamming48 ----------------------------------------------------------

def test_hamming48_zero():
    assert lib.hamming48(0xABCDEF123456, 0xABCDEF123456) == 0


def test_hamming48_full_48_bits():
    assert lib.hamming48(0x0, 0xFFFFFFFFFFFF) == 48


def test_hamming48_xor_count():
    # 0xAAAA = 10101010 10101010 has 8 ones; XOR with 0x5555 = 16 differing bits
    assert lib.hamming48(0xAAAA, 0x5555) == 16


# --- weighted_purity ----------------------------------------------------

def test_weighted_purity_perfect_recovery():
    purity, _ = lib.weighted_purity([0, 0, 1, 1], ["a", "a", "b", "b"])
    assert purity == 1.0


def test_weighted_purity_all_one_cluster_with_diverse_golds():
    # 1 cluster, 3 distinct golds, 1 each: plurality picks one, share = 1/3
    purity, rows = lib.weighted_purity([0, 0, 0], ["a", "b", "c"])
    assert abs(purity - 0.333) < 0.001
    assert len(rows) == 1


def test_weighted_purity_empty():
    purity, rows = lib.weighted_purity([], [])
    assert purity == 0.0
    assert rows == []


# --- category_entropy --------------------------------------------------

def test_category_entropy_uniform_is_max():
    h = lib.category_entropy(["a", "b", "c", "d"])
    assert abs(h - 2.0) < 0.001


def test_category_entropy_pure_is_zero():
    assert lib.category_entropy(["a", "a", "a"]) == 0.0


def test_category_entropy_empty_is_zero():
    assert lib.category_entropy([]) == 0.0


# --- decade_of ---------------------------------------------------------

def test_decade_of_modern():
    assert lib.decade_of(2017) == "2010s"


def test_decade_of_decade_boundary():
    assert lib.decade_of(2000) == "2000s"
    assert lib.decade_of(2020) == "2020s"


def test_decade_of_pre_1990():
    assert lib.decade_of(1985) == "pre-1990s"


# --- assign_to_class ---------------------------------------------------

def test_assign_to_class_nearest_centroid():
    classes = [
        {"id": 0, "centroid_fp48": 0xAAAAAAAAAAAA},
        {"id": 1, "centroid_fp48": 0x555555555555},
    ]
    assert lib.assign_to_class(0xAAAAAAAAAAAB, classes) == 0
    assert lib.assign_to_class(0x555555555554, classes) == 1


def test_assign_to_class_empty_classes_returns_none():
    assert lib.assign_to_class(0xABC, []) is None


# --- top_rare ----------------------------------------------------------

def test_top_rare_ranks_outliers_first():
    survivors = [
        {"fp48": 0x0, "id": "a"},
        {"fp48": 0x1, "id": "b"},
        {"fp48": 0xFFFFFFFFFFFF, "id": "c"},
    ]
    rare = lib.top_rare(survivors, k=2)
    assert rare[0]["id"] == "c"
    assert rare[0]["min_hamming"] >= 47


def test_top_rare_preserves_full_record():
    """The shared lib's top_rare spreads each survivor and adds min_hamming.
    Domain-specific URL fields are added by the caller."""
    survivors = [
        {"fp48": 0x0, "id": "a", "extra_field": "value-a"},
        {"fp48": 0xFFFFFFFFFFFF, "id": "b", "extra_field": "value-b"},
    ]
    rare = lib.top_rare(survivors, k=2)
    assert rare[0]["extra_field"] in ("value-a", "value-b")
    assert "min_hamming" in rare[0]


def test_top_rare_truncates_to_k():
    survivors = [{"fp48": (1 << i), "id": str(i)} for i in range(10)]
    assert len(lib.top_rare(survivors, k=3)) == 3


# --- bleed_per_class ---------------------------------------------------

def test_bleed_per_class_off_archive():
    survivors = [
        {"fp48": 0, "archive": "cs"},
        {"fp48": 1, "archive": "cs"},
        {"fp48": 2, "archive": "math"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = lib.bleed_per_class(survivors, classes, gold_field="archive")
    assert bleed[0]["dominant"] == "cs"
    assert "math" in bleed[0]["bleed_breakdown"]


def test_bleed_per_class_parameterized_gold_field():
    """gold_field='inventor_id' for Pulse, gold_field='archive' for Atlas."""
    survivors = [
        {"fp48": 0, "inventor_id": "X"},
        {"fp48": 1, "inventor_id": "X"},
        {"fp48": 2, "inventor_id": "Y"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = lib.bleed_per_class(survivors, classes, gold_field="inventor_id")
    assert bleed[0]["dominant"] == "X"
    assert "Y" in bleed[0]["bleed_breakdown"]


def test_bleed_per_class_pure_cluster_zero_bleed():
    survivors = [
        {"fp48": 0, "archive": "cs"},
        {"fp48": 1, "archive": "cs"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = lib.bleed_per_class(survivors, classes, gold_field="archive")
    assert bleed[0]["bleed_share"] == 0.0


# --- flag_emergence_candidates -----------------------------------------

def test_flag_emergence_candidates_filter():
    meta = [
        {"cluster_id": 0, "median_year": 2018, "year_spread": 4, "category_entropy": 2.5},
        {"cluster_id": 1, "median_year": 2002, "year_spread": 4, "category_entropy": 2.5},
        {"cluster_id": 2, "median_year": 2018, "year_spread": 12, "category_entropy": 2.5},
        {"cluster_id": 3, "median_year": 2018, "year_spread": 4, "category_entropy": 0.5},
    ]
    flagged = lib.flag_emergence_candidates(
        meta, min_median_year=2015, max_year_spread=5, min_category_entropy=2.0,
    )
    assert [c["cluster_id"] for c in flagged] == [0]


# --- stride_sample -----------------------------------------------------

def test_stride_sample_under_target_returns_all():
    assert lib.stride_sample([1, 2, 3], 10) == [1, 2, 3]


def test_stride_sample_zero_target_returns_all():
    assert lib.stride_sample([1, 2, 3], 0) == [1, 2, 3]


def test_stride_sample_evenly_spaced():
    assert lib.stride_sample(list(range(10)), 5) == [0, 2, 4, 6, 8]


def test_stride_sample_deterministic():
    items = list(range(100))
    assert lib.stride_sample(items, 7) == lib.stride_sample(items, 7)
