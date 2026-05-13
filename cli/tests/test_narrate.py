"""Tests for the narrate.plain_english operator.

The narrator is deterministic by contract: same aligned-modules input
must produce byte-identical narrative strings every run, with no LLM
drift in the loop. Tests pin that and exercise the empty / partial
alignment edge cases that real corpora hit.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.narrate import NarratePlainEnglish  # noqa: E402


def _aligned_module(mid: str = "m1", dom_share: float = 0.87, bleed: float = 0.13) -> dict:
    return {
        "module_id": mid,
        "alignment": {
            "k_nearest": 50,
            "dominant_label": "attack_dos",
            "dominant_share": dom_share,
            "bleed_share": bleed,
            "top3_labels": [
                {"label": "attack_dos", "count": 44, "share": dom_share},
                {"label": "attack_probe", "count": 4, "share": 0.08},
                {"label": "normal", "count": 2, "share": 0.04},
            ],
            "sample_records": [
                {"paper_id": "p1", "label": "attack_dos", "title": "Smurf flood pattern"},
                {"paper_id": "p2", "label": "attack_dos", "title": "Syn flood signature"},
            ],
        },
        "centroid_stats": {"mean": 0.01, "std": 0.42, "norm": 1.21, "dim": 128},
        "topology": {"homology_dim": 1, "birth": 0.1, "death": 0.6, "persistence": 0.5},
    }


def test_narrate_emits_one_per_module() -> None:
    op = NarratePlainEnglish()
    out = op.run(
        {"aligned_modules": [_aligned_module("m1"), _aligned_module("m2")]},
        seed=42,
        config={},
    )
    assert len(out["aligned_modules"]) == 2
    for m in out["aligned_modules"]:
        assert "narrative" in m and m["narrative"]


def test_narrate_is_deterministic() -> None:
    op = NarratePlainEnglish()
    inp = {"aligned_modules": [_aligned_module()]}
    a = op.run(inp, seed=42, config={})
    b = op.run(inp, seed=42, config={})
    assert a["aligned_modules"][0]["narrative"] == b["aligned_modules"][0]["narrative"]


def test_narrate_includes_label_and_share() -> None:
    op = NarratePlainEnglish()
    out = op.run({"aligned_modules": [_aligned_module()]}, seed=42, config={})
    text = out["aligned_modules"][0]["narrative"]
    assert "attack_dos" in text
    assert "87%" in text or "87 %" in text or " 87" in text


def test_narrate_alternative_labels_emerge_in_bleed_clause() -> None:
    op = NarratePlainEnglish()
    out = op.run({"aligned_modules": [_aligned_module()]}, seed=42, config={"top_k_alt_labels": 2})
    text = out["aligned_modules"][0]["narrative"]
    assert "attack_probe" in text
    assert "normal" in text


def test_narrate_handles_missing_alignment_gracefully() -> None:
    """A module without alignment data must not crash the narrator."""
    op = NarratePlainEnglish()
    out = op.run(
        {"aligned_modules": [{"module_id": "stub"}]},
        seed=42,
        config={},
    )
    text = out["aligned_modules"][0]["narrative"]
    assert "no alignment data" in text or "no narrative" in text.lower()


def test_narrate_includes_topology_when_present() -> None:
    op = NarratePlainEnglish()
    out = op.run({"aligned_modules": [_aligned_module()]}, seed=42, config={})
    text = out["aligned_modules"][0]["narrative"]
    assert "persistent-homology" in text or "homology" in text


def test_narrate_omits_sample_titles_when_disabled() -> None:
    op = NarratePlainEnglish()
    out = op.run(
        {"aligned_modules": [_aligned_module()]},
        seed=42,
        config={"include_sample_titles": False},
    )
    text = out["aligned_modules"][0]["narrative"]
    assert "Smurf flood pattern" not in text
