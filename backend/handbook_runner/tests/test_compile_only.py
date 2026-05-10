"""Tests for the /api/handbook/validate endpoint (compile + type-check only)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.handbook_runner.server import create_app
from backend.handbook_runner.tests.test_rate_limit import FakeRedis


def _client() -> TestClient:
    return TestClient(create_app(redis=FakeRedis()))


def test_validate_clean_source_returns_ok() -> None:
    src = (
        "load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive\n"
        "embed text into 64 dimensions using tf-idf\n"
        "save to /tmp/x.json\n"
    )
    r = _client().post("/api/handbook/validate", json={"source": src})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True


def test_validate_type_error_returns_400_with_diagnostic() -> None:
    src = "cluster raw using tcd recursive loop\n"
    r = _client().post("/api/handbook/validate", json={"source": src})
    assert r.status_code == 400
    body = r.json()
    assert body["ok"] is False
    assert body["category"] in ("syntax", "type", "name")
