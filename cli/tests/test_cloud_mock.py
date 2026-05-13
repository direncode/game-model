"""Integration test for the cloud-replay mock and the replay code path."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

httpx = pytest.importorskip("httpx")

from lo.demo._cloud_mock import LocalCloudMock
from lo.demo.receipts import Ledger, Receipt
from lo.demo.replay import _call_cloud_run_ocean, replay_against_cloud, ReplayConfig


def _make_corpus(tmp_path: Path, payload: str = "dummy") -> Path:
    corpus = tmp_path / "corpus.ndjson"
    corpus.write_text(payload, encoding="utf-8")
    return corpus


def test_mock_starts_and_returns_sha(tmp_path: Path) -> None:
    corpus = _make_corpus(tmp_path)
    with LocalCloudMock() as mock:
        sha = _call_cloud_run_ocean(
            program_source="seed 42\nload corpus.ndjson\n",
            corpus_ndjson_path=corpus,
            api_key="test-key",
            base_url=mock.base_url,
            timeout=5.0,
        )
    assert isinstance(sha, str) and len(sha) == 64


def test_mock_idempotent_for_same_body(tmp_path: Path) -> None:
    corpus = _make_corpus(tmp_path, payload="identical bytes")
    with LocalCloudMock() as mock:
        sha1 = _call_cloud_run_ocean(
            program_source="program",
            corpus_ndjson_path=corpus,
            api_key="k",
            base_url=mock.base_url,
        )
        sha2 = _call_cloud_run_ocean(
            program_source="program",
            corpus_ndjson_path=corpus,
            api_key="k",
            base_url=mock.base_url,
        )
    assert sha1 == sha2


def test_replay_against_mock_records_live_source(tmp_path: Path) -> None:
    corpus_dir = tmp_path / "patents"
    corpus_dir.mkdir()
    (corpus_dir / "corpus.ndjson").write_text(
        "\n".join(json.dumps({"id": str(i), "text": f"r{i}", "label": "x"}) for i in range(3))
        + "\n",
        encoding="utf-8",
    )
    program_path = tmp_path / "program.ocean"
    program_path.write_text(
        "seed 42\nload corpus.ndjson\nembed text into 64 dimensions using tf-idf\n",
        encoding="utf-8",
    )

    led = Ledger(receipts=[
        Receipt(
            corpus_id="patents",
            display_name="Patents",
            corpus_sha256="c" * 64,
            artifact_sha256="a" * 64,
            wall_seconds=1.0,
            estimated_cost_usd=0.01,
            n_records=3,
            n_modules=2,
        ),
    ])

    with LocalCloudMock() as mock:
        cfg = ReplayConfig(
            program_path=program_path,
            base_url=mock.base_url,
            api_key="test-key",
            cache_path=tmp_path / "cache.json",
        )
        replay_against_cloud(
            ledger=led,
            work_root=tmp_path,
            config=cfg,
        )

    r = led.receipts[0]
    assert r.cloud_source == "live"
    assert r.cloud_artifact_sha256 is not None
    assert r.cloud_matches_local is False  # synthetic local hash; not equal


def test_replay_falls_back_to_cache_when_mock_offline(tmp_path: Path) -> None:
    cache_path = tmp_path / "cache.json"
    cache_path.write_text(
        json.dumps({
            "patents": {"sha": "d" * 64, "stored_at": "2026-04-01T00:00:00Z"},
        }),
        encoding="utf-8",
    )
    corpus_dir = tmp_path / "patents"
    corpus_dir.mkdir()
    (corpus_dir / "corpus.ndjson").write_text("{}\n", encoding="utf-8")
    program_path = tmp_path / "program.ocean"
    program_path.write_text("seed 42\nload corpus.ndjson\n", encoding="utf-8")

    led = Ledger(receipts=[
        Receipt(
            corpus_id="patents",
            display_name="Patents",
            corpus_sha256="c" * 64,
            artifact_sha256="d" * 64,
            wall_seconds=1.0,
            estimated_cost_usd=0.01,
            n_records=1,
            n_modules=1,
        ),
    ])
    cfg = ReplayConfig(
        program_path=program_path,
        base_url="http://127.0.0.1:1",  # nothing here; should fail fast
        api_key="test-key",
        cache_path=cache_path,
    )
    replay_against_cloud(ledger=led, work_root=tmp_path, config=cfg)
    r = led.receipts[0]
    assert r.cloud_source == "cached"
    assert r.cloud_cached_at == "2026-04-01T00:00:00Z"
    assert r.cloud_matches_local is True  # both 'd' * 64
