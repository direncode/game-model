"""Tests for narrate.llm_summary (free-tier; ships in wheel)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.narrate import NarrateLlmSummary  # noqa: E402


def _aligned_module(mid: str = "m1") -> dict:
    return {
        "module_id": mid,
        "alignment": {
            "k_nearest": 50,
            "dominant_label": "fraud",
            "dominant_share": 0.84,
            "bleed_share": 0.16,
            "top3_labels": [
                {"label": "fraud", "count": 42, "share": 0.84},
                {"label": "legit", "count": 6, "share": 0.12},
                {"label": "review", "count": 2, "share": 0.04},
            ],
            "sample_records": [
                {"paper_id": "p1", "label": "fraud", "title": "Stolen card pattern"},
                {"paper_id": "p2", "label": "fraud", "title": "Geo mismatch flag"},
            ],
        },
        "centroid_stats": {"norm": 1.1, "std": 0.3, "dim": 64},
    }


def test_falls_back_to_template_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    op = NarrateLlmSummary()
    out = op.run({"aligned_modules": [_aligned_module()]}, seed=42, config={})
    assert out["narrator_model"] == "template_fallback"
    m = out["aligned_modules"][0]
    assert m["narrative_source"] == "template_fallback"
    assert "fraud" in m["narrative"]


def test_falls_back_when_anthropic_sdk_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")
    monkeypatch.setitem(sys.modules, "anthropic", None)
    op = NarrateLlmSummary()
    out = op.run({"aligned_modules": [_aligned_module()]}, seed=42, config={})
    assert out["narrator_model"] == "template_fallback"


def test_routes_to_anthropic_when_available(monkeypatch: pytest.MonkeyPatch) -> None:
    import types

    fake_anthropic = types.ModuleType("anthropic")

    class _FakeResponse:
        def __init__(self, text: str) -> None:
            self.content = [types.SimpleNamespace(type="text", text=text)]

    class _FakeMessages:
        def __init__(self, calls: list) -> None:
            self._calls = calls

        def create(self, **kwargs):
            self._calls.append(kwargs)
            return _FakeResponse("This cluster is the fraud pattern.")

    class _FakeClient:
        def __init__(self, *, api_key: str) -> None:
            self.api_key = api_key
            self.calls: list = []
            self.messages = _FakeMessages(self.calls)

    fake_anthropic.Anthropic = _FakeClient
    monkeypatch.setitem(sys.modules, "anthropic", fake_anthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    op = NarrateLlmSummary()
    out = op.run(
        {"aligned_modules": [_aligned_module("m_fraud")]},
        seed=42,
        config={"model": "claude-haiku-4-5-20251001"},
    )
    assert out["narrator_model"] == "claude-haiku-4-5-20251001"
    m = out["aligned_modules"][0]
    assert m["narrative_source"] == "anthropic_llm"
    assert "fraud pattern" in m["narrative"]


def test_llm_call_failure_falls_back_per_module(monkeypatch: pytest.MonkeyPatch) -> None:
    import types

    fake_anthropic = types.ModuleType("anthropic")

    class _ThrowingMessages:
        def create(self, **kwargs):
            raise RuntimeError("simulated 503")

    class _ThrowingClient:
        def __init__(self, *, api_key: str) -> None:
            self.messages = _ThrowingMessages()

    fake_anthropic.Anthropic = _ThrowingClient
    monkeypatch.setitem(sys.modules, "anthropic", fake_anthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    op = NarrateLlmSummary()
    out = op.run({"aligned_modules": [_aligned_module()]}, seed=42, config={})
    m = out["aligned_modules"][0]
    assert m["narrative_source"] == "llm_error_fallback"


def test_handles_missing_alignment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    op = NarrateLlmSummary()
    out = op.run({"aligned_modules": [{"module_id": "stub"}]}, seed=42, config={})
    text = out["aligned_modules"][0]["narrative"].lower()
    assert "no alignment" in text or "no narrative" in text
