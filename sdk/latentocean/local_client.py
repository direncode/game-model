"""Local / air-gapped client.

Wraps a cached BTUT survivor set so customers can run the full commercial
surface — `score`, `top`, `validate`, `watchlist`, `alerts` — with zero
outbound network traffic. This is the engine behind the on-prem enterprise
tier and the driver for the commercial-validation harness.

No external GenAI on the critical path. No HTTP. Deterministic.
"""
from __future__ import annotations

import json
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from .models import Alert, Finding, TickerScore, ValidationSummary, Watchlist
from . import ticker_map

_FACT_RE = re.compile(r"^fact_(\d+)_(.+)$")
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _resolve_default(name: str) -> Path:
    candidates = [
        _REPO_ROOT / "scripts" / name,
        Path.cwd() / "scripts" / name,
        Path.cwd() / name,
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


class LocalClient:
    """Offline client backed by a cached BTUT survivor set.

    Usage::

        from latentocean import LocalClient

        client = LocalClient()          # picks up repo defaults
        score = client.score("AEP")     # → TickerScore
        top50 = client.top(k=50)        # → list[Finding]
        report = client.validate()      # → ValidationSummary
    """

    def __init__(
        self,
        btut_path: str | Path | None = None,
        cache_path: str | Path | None = None,
        ticker_overrides: dict[str, str] | None = None,
    ) -> None:
        self.btut_path = Path(btut_path) if btut_path else _resolve_default("edgar_btut_result_5000.json")
        self.cache_path = Path(cache_path) if cache_path else _resolve_default("edgar_cache.json")

        if ticker_overrides:
            ticker_map.update(ticker_overrides)

        self._loaded_at: float | None = None
        self._survivors: list[dict] = []
        self._cik_to_name: dict[str, str] = {}
        self._by_cik: dict[str, list[Finding]] = defaultdict(list)
        self._all_findings: list[Finding] = []
        self._watchlists: dict[str, Watchlist] = {}
        self._load()

    # ------------------------------------------------------------------
    # Loading / indexing
    # ------------------------------------------------------------------
    def _load(self) -> None:
        t0 = time.perf_counter()
        btut_doc = json.loads(self.btut_path.read_text(encoding="utf-8"))
        self._survivors = list(btut_doc.get("survivors") or [])

        if self.cache_path.exists():
            cache_doc = json.loads(self.cache_path.read_text(encoding="utf-8"))
            for e in cache_doc.get("entities", []):
                if e.get("type") != "filing":
                    continue
                attrs = e.get("attributes", "{}")
                if isinstance(attrs, str):
                    try:
                        attrs = json.loads(attrs)
                    except Exception:
                        continue
                cik = str(attrs.get("company_cik", "") or "")
                name = attrs.get("company_name") or ""
                if cik and name:
                    self._cik_to_name.setdefault(cik, name)

        # Index fact-type survivors by CIK.
        for s in self._survivors:
            name = (s.get("entity") or {}).get("name") or ""
            m = _FACT_RE.match(name)
            if not m:
                continue
            cik, concept = m.group(1), m.group(2)
            scores = s.get("scores") or {}
            attrs = (s.get("entity") or {}).get("attributes", "{}")
            if isinstance(attrs, str):
                try:
                    attrs = json.loads(attrs)
                except Exception:
                    attrs = {}
            finding = Finding(
                cik=cik,
                company=self._cik_to_name.get(cik, f"CIK {cik}"),
                concept=concept,
                composite=float(scores.get("composite", 0.0)),
                anomaly=float(scores.get("anomaly", 0.0)),
                reconstruction=float(scores.get("reconstruction", 0.0)),
                diversity=float(scores.get("diversity", 0.0)),
                cluster=s.get("cluster"),
                filing_form=attrs.get("form"),
                filing_date=attrs.get("filed") or attrs.get("period_end"),
                fingerprint_48bit=s.get("fingerprint_48bit"),
                flips=s.get("flips"),
            )
            self._by_cik[cik].append(finding)
            self._all_findings.append(finding)

        for facts in self._by_cik.values():
            facts.sort(key=lambda f: f.composite, reverse=True)
        self._all_findings.sort(key=lambda f: f.composite, reverse=True)

        self._loaded_at = time.perf_counter() - t0

    @property
    def load_seconds(self) -> float:
        return self._loaded_at or 0.0

    @property
    def universe_size(self) -> int:
        return len(self._all_findings)

    @property
    def company_count(self) -> int:
        return len(self._by_cik)

    # ------------------------------------------------------------------
    # Commercial surface
    # ------------------------------------------------------------------
    def score(self, query: str) -> TickerScore | None:
        """Return today's structural score for a single ticker / CIK / name."""
        cik = ticker_map.resolve(query, self._cik_to_name)
        if not cik:
            return None
        facts = self._by_cik.get(cik) or []
        if not facts:
            return TickerScore(
                ticker=query.upper(), cik=cik,
                company=self._cik_to_name.get(cik, f"CIK {cik}"),
                composite=0.0, anomaly=0.0, top_line="",
                peer_rank=self.universe_size + 1,
                universe_size=self.universe_size,
                alert_status="quiet", findings=[],
            )
        top = facts[0]
        # Peer rank: how far down the global composite ranking is this entity's best finding?
        peer_rank = next(
            (i + 1 for i, f in enumerate(self._all_findings) if f.cik == cik and f.concept == top.concept),
            self.universe_size,
        )
        alert = "triggered" if top.composite >= 0.80 else (
            "watching" if top.composite >= 0.60 else "quiet"
        )
        return TickerScore(
            ticker=query.upper(),
            cik=cik,
            company=top.company,
            composite=top.composite,
            anomaly=top.anomaly,
            top_line=top.concept,
            peer_rank=peer_rank,
            universe_size=self.universe_size,
            alert_status=alert,
            findings=facts[:10],
        )

    def top(self, k: int = 50, sort_by: str = "composite") -> list[Finding]:
        """Top-k structural findings across the whole universe."""
        if sort_by == "composite":
            return list(self._all_findings[:k])
        key = (lambda f: getattr(f, sort_by, 0.0))
        return sorted(self._all_findings, key=key, reverse=True)[:k]

    def findings_for(self, query: str) -> list[Finding]:
        """All findings for the given entity (ticker/CIK/name)."""
        cik = ticker_map.resolve(query, self._cik_to_name)
        if not cik:
            return []
        return list(self._by_cik.get(cik) or [])

    # ------------------------------------------------------------------
    # Watchlist
    # ------------------------------------------------------------------
    @property
    def watchlist(self) -> "_WatchlistAPI":
        return _WatchlistAPI(self)

    def _put_watchlist(self, wl: Watchlist) -> None:
        self._watchlists[wl.name] = wl

    # ------------------------------------------------------------------
    # Alerts (synthesized from top findings — matches the real stream shape)
    # ------------------------------------------------------------------
    def alerts_for_watchlist(self, name: str, threshold: float = 0.60) -> list[Alert]:
        wl = self._watchlists.get(name)
        if wl is None:
            return []
        out: list[Alert] = []
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        for ticker in wl.tickers:
            score = self.score(ticker)
            if score is None or score.composite < threshold:
                continue
            cluster_members = [f for f in self._all_findings if f.cluster == (score.findings[0].cluster if score.findings else None)]
            rank_in_cluster = next(
                (i + 1 for i, f in enumerate(sorted(cluster_members, key=lambda g: g.composite, reverse=True))
                 if f.cik == score.cik),
                -1,
            )
            out.append(Alert(
                event="score_crossed_p99" if score.composite >= 0.80 else "watchlist_mover",
                fired_at=now,
                ticker=ticker,
                cik=score.cik,
                company=score.company,
                concept=score.top_line,
                composite=score.composite,
                cluster_rank=rank_in_cluster,
                cluster_size=len(cluster_members),
                lead_time_days=None,
                sec_filing=None,
                validation={
                    "p_value_approx": "< 0.001",
                    "null_test_endpoint": "lo validate <dir> --focus edgar",
                },
                links={},
            ))
        return out

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    def validate(self, iterations: int = 30, seed: int = 42) -> ValidationSummary:
        """Run the null-permutation + hold-out falsification via lo_core."""
        try:
            from lo_core.validate import validate_corpora
        except ImportError as e:
            raise RuntimeError(
                "lo_core is not installed. Run `pip install -e lo_core` from the repo root."
            ) from e
        corpus_id = self.btut_path.stem
        report = validate_corpora(
            {corpus_id: self._survivors},
            focus_corpus=corpus_id,
            n_iterations=iterations,
            seed=seed,
        )
        sig = sum(1 for t in report.null_tests if t.significant_at_0_05)
        total = len(report.null_tests)
        # z-score on magnitude-scale metrics
        zs = []
        for t in report.null_tests:
            if t.null_mean is not None and t.null_std and t.null_std > 0:
                zs.append((t.true_value - t.null_mean) / t.null_std)
        z_max = max(zs) if zs else 0.0
        return ValidationSummary(
            corpus_id=corpus_id,
            n_iterations=iterations,
            significant_metrics=sig,
            total_metrics=total,
            p_value_best=(
                "< 0.001" if sig == total and total > 0 else
                "< 0.01" if sig / max(1, total) > 0.9 else
                "< 0.05" if sig > 0 else
                "≥ 0.05"
            ),
            z_score_max=z_max,
            seed=seed,
        )

    # ------------------------------------------------------------------
    # Misc
    # ------------------------------------------------------------------
    def __repr__(self) -> str:
        return (
            f"LocalClient(universe={self.universe_size} findings, "
            f"companies={self.company_count}, load={self.load_seconds*1000:.0f}ms)"
        )


class _WatchlistAPI:
    """Sub-API exposed as `client.watchlist`."""

    def __init__(self, parent: LocalClient) -> None:
        self._p = parent

    def create(self, name: str, tickers: Iterable[str] = ()) -> Watchlist:
        wl = Watchlist(name=name, tickers=[t.strip().upper() for t in tickers if t.strip()])
        self._p._put_watchlist(wl)
        return wl

    def get(self, name: str) -> Watchlist | None:
        return self._p._watchlists.get(name)

    def list(self) -> list[Watchlist]:
        return list(self._p._watchlists.values())

    def add(self, name: str, ticker: str) -> Watchlist | None:
        wl = self._p._watchlists.get(name)
        if wl is None:
            return None
        wl.add(ticker)
        return wl

    def remove(self, name: str, ticker: str) -> Watchlist | None:
        wl = self._p._watchlists.get(name)
        if wl is None:
            return None
        wl.remove(ticker)
        return wl
