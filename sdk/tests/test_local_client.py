"""End-to-end smoke test for the local / air-gap SDK surface.

Exercises the full commercial path: score, top, watchlist, alerts, validate.
Uses the cached EDGAR BTUT run — no HTTP, no network.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from latentocean import Finding, LocalClient, TickerScore, ValidationSummary, Watchlist


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BTUT = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"
CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"

pytestmark = pytest.mark.skipif(
    not BTUT.exists(), reason="cached BTUT output not present in this checkout"
)


@pytest.fixture(scope="module")
def client() -> LocalClient:
    return LocalClient(btut_path=BTUT, cache_path=CACHE)


def test_load_populates_universe(client: LocalClient) -> None:
    assert client.universe_size > 500
    assert client.company_count > 100
    assert client.load_seconds >= 0


def test_score_known_ticker(client: LocalClient) -> None:
    aep = client.score("AEP")
    assert aep is not None
    assert aep.cik == "4904"
    assert "AMERICAN ELECTRIC POWER" in aep.company.upper()
    assert aep.top_line.startswith("AssetRetirementObligation")
    assert 0.0 < aep.composite <= 1.0


def test_score_returns_none_for_unknown(client: LocalClient) -> None:
    assert client.score("XXUNKNOWNXX99") is None


def test_top_returns_sorted_findings(client: LocalClient) -> None:
    top = client.top(k=20)
    assert len(top) == 20
    assert all(isinstance(f, Finding) for f in top)
    scores = [f.composite for f in top]
    assert scores == sorted(scores, reverse=True)


def test_watchlist_round_trip(client: LocalClient) -> None:
    wl = client.watchlist.create("short-candidates", tickers=["AEP", "NVDA", "AAPL"])
    assert isinstance(wl, Watchlist)
    assert wl.tickers == ["AEP", "NVDA", "AAPL"]
    client.watchlist.add("short-candidates", "ERIE")
    got = client.watchlist.get("short-candidates")
    assert got and "ERIE" in got.tickers
    client.watchlist.remove("short-candidates", "AAPL")
    assert "AAPL" not in client.watchlist.get("short-candidates").tickers


def test_alerts_for_watchlist(client: LocalClient) -> None:
    client.watchlist.create("triggers", tickers=["AEP"])
    alerts = client.alerts_for_watchlist("triggers", threshold=0.5)
    assert alerts
    assert alerts[0].ticker == "AEP"
    assert alerts[0].composite > 0.5


def test_validate_runs_null(client: LocalClient) -> None:
    summary = client.validate(iterations=3, seed=42)
    assert isinstance(summary, ValidationSummary)
    assert summary.n_iterations == 3
    assert summary.total_metrics > 0


def test_determinism_across_instances() -> None:
    c1 = LocalClient(btut_path=BTUT, cache_path=CACHE)
    c2 = LocalClient(btut_path=BTUT, cache_path=CACHE)
    top1 = [(f.cik, f.concept, round(f.composite, 6)) for f in c1.top(50)]
    top2 = [(f.cik, f.concept, round(f.composite, 6)) for f in c2.top(50)]
    assert top1 == top2, "LocalClient must be deterministic across independent loads"
