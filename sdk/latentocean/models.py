"""Commercial SDK response types.

These wrap the objects customers actually read in their Excel add-in,
Bloomberg panel, or Python scripts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Finding:
    """A single structural anomaly on one XBRL concept for one entity."""

    cik: str
    company: str
    concept: str
    composite: float
    anomaly: float
    reconstruction: float
    diversity: float
    cluster: int | None = None
    filing_form: str | None = None
    filing_date: str | None = None
    fingerprint_48bit: str | None = None
    flips: int | None = None

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


@dataclass
class TickerScore:
    """What `client.score("AAPL")` returns.

    Mirrors the Excel formula surface `=LO.SCORE(ticker)`.
    """

    ticker: str
    cik: str
    company: str
    composite: float
    anomaly: float
    top_line: str
    peer_rank: int
    universe_size: int
    alert_status: str = "quiet"  # "quiet" | "watching" | "triggered:<date>"
    findings: list[Finding] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "cik": self.cik,
            "company": self.company,
            "composite": self.composite,
            "anomaly": self.anomaly,
            "top_line": self.top_line,
            "peer_rank": self.peer_rank,
            "universe_size": self.universe_size,
            "alert_status": self.alert_status,
            "findings": [f.to_dict() for f in self.findings],
        }


@dataclass
class Watchlist:
    """A named watchlist of tickers."""

    name: str
    tickers: list[str] = field(default_factory=list)

    def add(self, ticker: str) -> None:
        t = ticker.strip().upper()
        if t and t not in self.tickers:
            self.tickers.append(t)

    def remove(self, ticker: str) -> None:
        t = ticker.strip().upper()
        if t in self.tickers:
            self.tickers.remove(t)


@dataclass
class Alert:
    """What a subscriber receives when a trigger fires."""

    event: str          # "restatement_detected" | "score_crossed_p99" | "new_10ka" | "watchlist_mover"
    fired_at: str       # ISO8601
    ticker: str
    cik: str
    company: str
    concept: str
    composite: float
    cluster_rank: int
    cluster_size: int
    lead_time_days: int | None = None
    sec_filing: dict[str, Any] | None = None
    validation: dict[str, Any] | None = None
    links: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "event": self.event,
            "fired_at": self.fired_at,
            "ticker": self.ticker,
            "cik": self.cik,
            "company": self.company,
            "concept": self.concept,
            "composite": self.composite,
            "cluster_rank": self.cluster_rank,
            "cluster_size": self.cluster_size,
            "lead_time_days": self.lead_time_days,
            "sec_filing": self.sec_filing,
            "validation": self.validation,
            "links": self.links,
        }


@dataclass
class ValidationSummary:
    """Compact result of `client.validate(...)`."""

    corpus_id: str
    n_iterations: int
    significant_metrics: int
    total_metrics: int
    p_value_best: str             # "< 0.001" style
    z_score_max: float
    seed: int = 42
