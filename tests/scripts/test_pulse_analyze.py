"""Tests for scripts/pulse_analyze.py - Pulse-specific primitives.

Covers the disambiguation-specific primitives that turn BTUT survivors into
the public artifact: naive_name_labels, flag_singular_inventors, uspto_url,
compute_cluster_meta, baseline_disambiguators.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import pulse_analyze  # noqa: E402

FIXTURE_CORPUS = REPO / "tests" / "scripts" / "fixtures" / "pulse_corpus.ndjson"
FIXTURE_MODEL  = REPO / "tests" / "scripts" / "fixtures" / "pulse_survivors.json"


# --- naive_name_labels ------------------------------------------------

def test_naive_name_collapses_same_canonical_name():
    survivors = [
        {"canonical_name": "Smith J W", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Smith J W", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Chen A B",  "patentsview_inventor_id": "inv_bbb"},
    ]
    naive = pulse_analyze.naive_name_labels(survivors)
    assert naive[0] == naive[1]
    assert naive[0] != naive[2]


def test_naive_name_handles_collision():
    """Two PatentsView inventor_ids with the same canonical_name collapse incorrectly.
    That collapse is the failure mode the engine should beat."""
    survivors = [
        {"canonical_name": "Smith J", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Smith J", "patentsview_inventor_id": "inv_ccc"},
    ]
    naive = pulse_analyze.naive_name_labels(survivors)
    assert naive[0] == naive[1]


def test_naive_name_empty_canonical_returns_empty_string():
    survivors = [{"canonical_name": ""}]
    assert pulse_analyze.naive_name_labels(survivors) == [""]


# --- flag_singular_inventors ------------------------------------------

def test_singular_inventor_combines_all_four_signals():
    cluster_meta = [
        {"cluster_id": 0, "patent_count": 50, "ipc_entropy": 2.0, "career_span": 25, "solo_share": 0.8},
        {"cluster_id": 1, "patent_count": 50, "ipc_entropy": 0.0, "career_span": 25, "solo_share": 0.8},  # uniform IPC
        {"cluster_id": 2, "patent_count": 2,  "ipc_entropy": 2.0, "career_span": 25, "solo_share": 0.8},  # too few patents
        {"cluster_id": 3, "patent_count": 50, "ipc_entropy": 2.0, "career_span": 5,  "solo_share": 0.8},  # short career
        {"cluster_id": 4, "patent_count": 50, "ipc_entropy": 2.0, "career_span": 25, "solo_share": 0.1},  # low solo share
    ]
    flagged = pulse_analyze.flag_singular_inventors(
        cluster_meta,
        min_patent_count=10, min_ipc_entropy=1.0,
        min_career_span=10, min_solo_share=0.5,
    )
    assert [c["cluster_id"] for c in flagged] == [0]


def test_singular_inventor_empty_when_no_match():
    cluster_meta = [
        {"cluster_id": 0, "patent_count": 1, "ipc_entropy": 0.0, "career_span": 0, "solo_share": 0.0},
    ]
    flagged = pulse_analyze.flag_singular_inventors(
        cluster_meta, min_patent_count=10, min_ipc_entropy=1.0,
        min_career_span=10, min_solo_share=0.5,
    )
    assert flagged == []


# --- uspto_url --------------------------------------------------------

def test_uspto_url_format():
    assert pulse_analyze.uspto_url("10000000") == "https://patents.uspto.gov/patent/10000000"


def test_uspto_url_string_id():
    assert pulse_analyze.uspto_url("PP12345") == "https://patents.uspto.gov/patent/PP12345"


# --- compute_cluster_meta ---------------------------------------------

def test_compute_cluster_meta_signals():
    survivors = [
        {"patent_id": "p1", "primary_ipc": "G", "year": 2010, "co_inventors_canonical": []},
        {"patent_id": "p2", "primary_ipc": "G", "year": 2015, "co_inventors_canonical": ["Other"]},
        {"patent_id": "p3", "primary_ipc": "H", "year": 2020, "co_inventors_canonical": []},
    ]
    engine_labels = [0, 0, 0]  # all in cluster 0
    meta = pulse_analyze.compute_cluster_meta(survivors, engine_labels)
    assert len(meta) == 1
    cluster = meta[0]
    assert cluster["cluster_id"] == 0
    assert cluster["patent_count"] == 3
    assert cluster["career_span"] == 10  # 2020 - 2010
    assert cluster["solo_share"] == round(2 / 3, 3)  # 2 of 3 have empty co_inventors
    assert cluster["ipc_entropy"] > 0  # mixed IPC


def test_compute_cluster_meta_filters_none_labels():
    """Survivors whose engine label is None get excluded."""
    survivors = [
        {"patent_id": "p1", "primary_ipc": "G", "year": 2020, "co_inventors_canonical": []},
        {"patent_id": "p2", "primary_ipc": "H", "year": 2020, "co_inventors_canonical": []},
    ]
    engine_labels = [0, None]
    meta = pulse_analyze.compute_cluster_meta(survivors, engine_labels)
    assert len(meta) == 1
    assert meta[0]["cluster_id"] == 0
    assert meta[0]["patent_count"] == 1


# --- baseline_disambiguators -----------------------------------------

def test_baseline_disambiguators_shape():
    survivors = [
        {"canonical_name": "Smith J", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Smith J", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Chen A",  "patentsview_inventor_id": "inv_bbb"},
    ]
    engine_labels = [0, 0, 1]
    panel = pulse_analyze.baseline_disambiguators(survivors, engine_labels)
    assert "engine" in panel
    assert "patentsview" in panel
    assert "naive_name" in panel
    assert "chance" in panel
    # Engine clusters perfectly here (cluster 0 = both Smith records, cluster 1 = Chen)
    assert panel["engine"] == 1.0
    # Naive collapses to canonical_name; same as engine in this trivial case
    assert panel["naive_name"] == 1.0
    # Chance: 1 / 2 distinct PatentsView ids = 0.5
    assert panel["chance"] == 0.5
