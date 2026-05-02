"""Tests for scripts/arxiv_analyze.py pure functions.

Covers the analytical primitives that turn BTUT survivors into the public
artifact: archive_of, weighted_purity, decade_of, top_rare, assign_to_class,
bleed_per_class, category_entropy, and flag_emergence_candidates.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import arxiv_analyze  # noqa: E402


# --- archive_of ----------------------------------------------------------

def test_archive_of_dotted_categories():
    assert arxiv_analyze.archive_of("cs.LG") == "cs"
    assert arxiv_analyze.archive_of("math.NT") == "math"
    assert arxiv_analyze.archive_of("q-bio.GN") == "q-bio"
    assert arxiv_analyze.archive_of("physics.optics") == "physics"
    assert arxiv_analyze.archive_of("stat.ML") == "stat"


def test_archive_of_legacy_dashed_categories():
    assert arxiv_analyze.archive_of("hep-th") == "hep-th"
    assert arxiv_analyze.archive_of("astro-ph") == "astro-ph"
    assert arxiv_analyze.archive_of("cond-mat") == "cond-mat"


def test_archive_of_empty_string():
    assert arxiv_analyze.archive_of("") == ""


# --- weighted_purity -----------------------------------------------------

def test_weighted_purity_perfect_recovery():
    labels = [0, 0, 0, 1, 1, 1]
    golds = ["cs", "cs", "cs", "math", "math", "math"]
    purity, rows = arxiv_analyze.weighted_purity(labels, golds)
    assert purity == 1.0
    assert len(rows) == 2


def test_weighted_purity_mixed_clusters():
    # Cluster 0: 2 cs + 1 math (plurality cs, share 2/3)
    # Cluster 1: 2 math + 1 cs (plurality math, share 2/3)
    labels = [0, 0, 0, 1, 1, 1]
    golds = ["cs", "cs", "math", "math", "math", "cs"]
    purity, _ = arxiv_analyze.weighted_purity(labels, golds)
    assert abs(purity - 0.667) < 0.001


def test_weighted_purity_chance_baseline():
    # 4 labels uniformly, 4 archives uniformly; one record per (label, gold)
    labels = [0, 1, 2, 3]
    golds = ["cs", "math", "physics", "stat"]
    purity, rows = arxiv_analyze.weighted_purity(labels, golds)
    assert purity == 1.0
    assert len(rows) == 4


def test_weighted_purity_empty_input():
    purity, rows = arxiv_analyze.weighted_purity([], [])
    assert purity == 0.0
    assert rows == []


# --- decade_of -----------------------------------------------------------

def test_decade_of_canonical_years():
    assert arxiv_analyze.decade_of(1995) == "1990s"
    assert arxiv_analyze.decade_of(2000) == "2000s"
    assert arxiv_analyze.decade_of(2007) == "2000s"
    assert arxiv_analyze.decade_of(2017) == "2010s"
    assert arxiv_analyze.decade_of(2024) == "2020s"


def test_decade_of_pre_1990():
    assert arxiv_analyze.decade_of(1985) == "pre-1990s"


# --- category_entropy ----------------------------------------------------

def test_category_entropy_uniform_is_max():
    # 4 distinct categories, each appearing once -> entropy = log2(4) = 2.0
    h = arxiv_analyze.category_entropy(["cs.LG", "math.NT", "physics.optics", "q-bio.GN"])
    assert abs(h - 2.0) < 0.001


def test_category_entropy_single_category_is_zero():
    h = arxiv_analyze.category_entropy(["cs.LG", "cs.LG", "cs.LG"])
    assert h == 0.0


def test_category_entropy_empty_is_zero():
    assert arxiv_analyze.category_entropy([]) == 0.0


# --- flag_emergence_candidates -------------------------------------------

def test_flag_emergence_candidates_filters_correctly():
    cluster_meta = [
        {"cluster_id": 0, "median_year": 2018, "year_spread": 4, "category_entropy": 2.5},  # candidate
        {"cluster_id": 1, "median_year": 2002, "year_spread": 4, "category_entropy": 2.5},  # too old
        {"cluster_id": 2, "median_year": 2018, "year_spread": 12, "category_entropy": 2.5}, # too wide
        {"cluster_id": 3, "median_year": 2018, "year_spread": 4, "category_entropy": 0.5},  # too uniform
    ]
    candidates = arxiv_analyze.flag_emergence_candidates(
        cluster_meta,
        min_median_year=2015, max_year_spread=5, min_category_entropy=2.0,
    )
    assert [c["cluster_id"] for c in candidates] == [0]


def test_flag_emergence_candidates_empty_when_none_match():
    cluster_meta = [
        {"cluster_id": 0, "median_year": 1995, "year_spread": 30, "category_entropy": 0.0},
    ]
    candidates = arxiv_analyze.flag_emergence_candidates(
        cluster_meta,
        min_median_year=2015, max_year_spread=5, min_category_entropy=2.0,
    )
    assert candidates == []


# --- hamming48 -----------------------------------------------------------

def test_hamming48_zero_distance_is_zero():
    assert arxiv_analyze.hamming48(0xABCDEF123456, 0xABCDEF123456) == 0


def test_hamming48_single_bit_flip():
    assert arxiv_analyze.hamming48(0x0, 0x1) == 1
    assert arxiv_analyze.hamming48(0x0, 0xFFFFFFFFFFFF) == 48


def test_hamming48_xor_count():
    # 0xAAAA = 10101010 10101010 has 8 ones; 0x5555 = 01010101 01010101 has 8 ones
    # XOR = 0xFFFF = 16 ones
    assert arxiv_analyze.hamming48(0xAAAA, 0x5555) == 16


# --- assign_to_class -----------------------------------------------------

def test_assign_to_class_picks_nearest_centroid():
    classes = [
        {"id": 0, "centroid_fp48": 0xAAAAAAAAAAAA},
        {"id": 1, "centroid_fp48": 0x555555555555},
        {"id": 2, "centroid_fp48": 0x000000FFFFFF},
    ]
    # fp48 with 1-bit perturbation off the cs centroid (0xAA...) lands in class 0
    assert arxiv_analyze.assign_to_class(0xAAAAAAAAAAAB, classes) == 0
    # fp48 close to math centroid (0x55...) lands in class 1
    assert arxiv_analyze.assign_to_class(0x555555555554, classes) == 1


def test_assign_to_class_returns_none_for_empty_classes():
    assert arxiv_analyze.assign_to_class(0xABC, []) is None


# --- top_rare ------------------------------------------------------------

def test_top_rare_ranks_isolated_survivors_first():
    survivors = [
        {"idx": 0, "fp48": 0xAAAAAAAAAAAA, "paper_id": "1", "title": "A", "year": 2020,
         "primary_category": "cs.LG", "archive": "cs"},
        {"idx": 1, "fp48": 0xAAAAAAAAAAAB, "paper_id": "2", "title": "B", "year": 2020,
         "primary_category": "cs.LG", "archive": "cs"},
        # This one is far from the cs cluster -> should rank rarest
        {"idx": 2, "fp48": 0x555555555555, "paper_id": "3", "title": "ISOLATED", "year": 2020,
         "primary_category": "math.NT", "archive": "math"},
    ]
    rare = arxiv_analyze.top_rare(survivors, k=2)
    assert rare[0]["paper_id"] == "3"
    assert rare[0]["title"] == "ISOLATED"
    assert rare[0]["arxiv_url"] == "https://arxiv.org/abs/3"
    assert rare[0]["min_hamming"] >= 24, "isolated survivor's min-hamming should be large"


def test_top_rare_truncates_to_k():
    survivors = [
        {"idx": i, "fp48": (1 << i), "paper_id": str(i), "title": f"T{i}", "year": 2020,
         "primary_category": "cs.LG", "archive": "cs"}
        for i in range(10)
    ]
    rare = arxiv_analyze.top_rare(survivors, k=3)
    assert len(rare) == 3


# --- bleed_per_class -----------------------------------------------------

def test_bleed_per_class_identifies_off_archive_papers():
    # Cluster 0 centroid at 0; three survivors all near 0.
    # 2 are 'cs', 1 is 'math'. Cluster's dominant archive is 'cs'; the math
    # paper bleeds in.
    survivors = [
        {"fp48": 0, "primary_category": "cs.LG", "archive": "cs", "year": 2020,
         "paper_id": "1", "title": "A"},
        {"fp48": 0x1, "primary_category": "cs.AI", "archive": "cs", "year": 2020,
         "paper_id": "2", "title": "B"},
        {"fp48": 0x2, "primary_category": "math.NT", "archive": "math", "year": 2020,
         "paper_id": "3", "title": "C"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = arxiv_analyze.bleed_per_class(survivors, classes)
    assert len(bleed) == 1
    assert bleed[0]["dominant"] == "cs"
    assert abs(bleed[0]["bleed_share"] - round(1 / 3, 3)) < 0.001
    assert "math" in bleed[0]["bleed_breakdown"]
    assert bleed[0]["bleed_breakdown"]["math"] == 1


def test_bleed_per_class_pure_cluster_has_zero_bleed():
    survivors = [
        {"fp48": 0, "primary_category": "cs.LG", "archive": "cs", "year": 2020,
         "paper_id": "1", "title": "A"},
        {"fp48": 0x1, "primary_category": "cs.AI", "archive": "cs", "year": 2020,
         "paper_id": "2", "title": "B"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = arxiv_analyze.bleed_per_class(survivors, classes)
    assert bleed[0]["bleed_share"] == 0.0
    assert bleed[0]["bleed_breakdown"] == {}
