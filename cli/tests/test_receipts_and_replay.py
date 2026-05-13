"""Tests for the receipts ledger and the cloud-replay status logic.

We don't talk to the actual cloud here — those round-trips need a live
deployment. Instead we verify the *contract* the TUI relies on:

* ``cloud_source`` reliably distinguishes live vs cached vs absent.
* ``cloud_status_label`` renders a human-readable string for each.
* The cache writer only persists *live* hashes (caching a cached hash
  would freeze stale values forever).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from lo.demo.receipts import Ledger, Receipt
from lo.demo import replay as replay_mod


def _make_receipt(corpus_id: str = "patents") -> Receipt:
    return Receipt(
        corpus_id=corpus_id,
        display_name="Patents",
        corpus_sha256="c" * 64,
        artifact_sha256="a" * 64,
        wall_seconds=1.0,
        estimated_cost_usd=0.01,
        n_records=100,
        n_modules=10,
    )


def test_cloud_status_label_live() -> None:
    r = _make_receipt()
    r.cloud_source = "live"
    assert r.cloud_status_label() == "live"


def test_cloud_status_label_cached_with_date() -> None:
    r = _make_receipt()
    r.cloud_source = "cached"
    r.cloud_cached_at = "2026-04-15T08:00:00Z"
    label = r.cloud_status_label()
    assert "cached" in label
    assert "2026-04-15" in label


def test_cloud_status_label_absent() -> None:
    r = _make_receipt()
    r.cloud_source = "absent"
    assert r.cloud_status_label() == "local only"


def test_ledger_serialization_includes_cloud_source(tmp_path: Path) -> None:
    """The ledger.to_dict()/save() round-trip must preserve the new fields."""
    r = _make_receipt()
    r.cloud_source = "live"
    r.cloud_artifact_sha256 = "a" * 64
    r.cloud_matches_local = True
    led = Ledger(receipts=[r])
    out = tmp_path / "ledger.json"
    led.save(out)
    data = json.loads(out.read_text(encoding="utf-8"))
    rec = data["receipts"][0]
    assert rec["cloud_source"] == "live"
    assert rec["cloud_artifact_sha256"] == "a" * 64
    assert rec["cloud_matches_local"] is True


def test_cache_get_legacy_flat_format() -> None:
    """Old caches wrote ``{corpus_id: sha}``; new readers must accept both."""
    cache = {"patents": "f" * 64}
    sha, stored_at = replay_mod._cache_get(cache, "patents")
    assert sha == "f" * 64
    assert stored_at is None


def test_cache_get_new_nested_format() -> None:
    cache = {
        "patents": {"sha": "9" * 64, "stored_at": "2026-04-15T08:00:00Z"},
    }
    sha, stored_at = replay_mod._cache_get(cache, "patents")
    assert sha == "9" * 64
    assert stored_at == "2026-04-15T08:00:00Z"


def test_cache_get_missing() -> None:
    sha, stored_at = replay_mod._cache_get({}, "patents")
    assert sha is None and stored_at is None


def test_cache_get_garbage_entry() -> None:
    """A corrupt cache entry must not raise; readers degrade gracefully."""
    sha, stored_at = replay_mod._cache_get({"patents": 12345}, "patents")
    assert sha is None and stored_at is None
