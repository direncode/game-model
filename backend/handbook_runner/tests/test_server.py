"""End-to-end tests for the /api/handbook/run endpoint."""
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.handbook_runner.server import create_app
from backend.handbook_runner.tests.test_rate_limit import FakeRedis


def _client():
    app = create_app(redis=FakeRedis())
    return TestClient(app)


def test_too_large_source_returns_413():
    client = _client()
    too_big = "x" * (16 * 1024 + 1)
    resp = client.post(
        "/api/handbook/run", json={"source": too_big, "corpus": "toy_tna_50"}
    )
    assert resp.status_code == 413


def test_unknown_corpus_returns_400():
    client = _client()
    resp = client.post(
        "/api/handbook/run",
        json={"source": "load whatever take 5 records\n", "corpus": "nonexistent"},
    )
    assert resp.status_code == 400


def test_compile_error_returns_400_with_diagnostic():
    client = _client()
    resp = client.post(
        "/api/handbook/run",
        json={
            "source": "cluster raw using tcd recursive loop\n",
            "corpus": "toy_tna_50",
        },
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["ok"] is False
    assert body["category"] in ("syntax", "type", "name")
    assert "line" in body["diagnostic"]


def test_premium_op_returns_runtime_diagnostic():
    source = (
        "load _toy_corpora/toy_tna_50.ndjson take 30 records balanced by archive\n"
        "embed text into 128 dimensions using content fingerprint\n"
        "save to /tmp/test.json\n"
    )
    client = _client()
    resp = client.post(
        "/api/handbook/run", json={"source": source, "corpus": "toy_tna_50"}
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["ok"] is False
    assert body["category"] == "runtime"
    assert "api key" in body["diagnostic"]["message"].lower()
