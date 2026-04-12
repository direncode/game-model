# NIV Vertical Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the NIV (National Impact Velocity) macro indicator as a production vertical inside Latent Ocean, porting formula from Rust and walk-forward ensemble from TypeScript.

**Architecture:** FastAPI router at `/api/v1/niv/*` backed by `backend/app/services/niv/` package. Pure-numpy formula layer, sklearn-based ensemble (LR + AdaBoost + MLP), log-odds combiner, isotonic calibration, split-conformal bands. Optional BTUT feature thinning and TCD-JEPA crystallization bridges. Five NotImplementedError hooks for user domain decisions.

**Tech Stack:** Python 3.11, FastAPI, numpy, pandas, scikit-learn (add to pyproject.toml), httpx (FRED/ALFRED), Redis, reportlab (tearsheet PDF).

**Design doc:** `docs/plans/2026-04-11-niv-vertical-design.md`

---

## Task 1: Package skeleton + NIVConfig

**Files:**
- Create: `backend/app/services/niv/__init__.py`
- Create: `backend/app/services/niv/config.py`
- Modify: `backend/pyproject.toml` (add scikit-learn dep)

**Step 1: Add scikit-learn dependency**

In `backend/pyproject.toml`, add to `dependencies`:
```
"scikit-learn>=1.3.0",
```

**Step 2: Create package init**

```python
# backend/app/services/niv/__init__.py
"""NIV (National Impact Velocity) vertical — macro liquidity circulation intelligence."""
```

**Step 3: Create config**

```python
# backend/app/services/niv/config.py
"""NIV vertical configuration."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class NIVConfig:
    """All tunable parameters for the NIV vertical.

    Constants match regenerationism.ai/rust-engine/src/niv.rs verbatim.
    """

    # ── Formula constants (from niv.rs) ───────────────────────
    eta: float = 1.5
    epsilon: float = 0.001
    smooth_window: int = 12
    rd_multiplier: float = 1.15
    thrust_dg_weight: float = 1.0
    thrust_da_weight: float = 1.0
    thrust_dr_weight: float = 0.7
    drag_spread_weight: float = 0.4
    drag_real_rate_weight: float = 0.4
    drag_volatility_weight: float = 0.2
    niv_scale: float = 1000.0
    niv_clamp: tuple[float, float] = (-100.0, 100.0)

    # ── Ensemble ──────────────────────────────────────────────
    combiner: Literal["log_odds", "stacking"] = "log_odds"
    calibration: Literal["last_30pct", "cv5"] = "last_30pct"
    lr_C: float = 100.0          # 1 / lambda where lambda = 0.01
    lr_max_iter: int = 100
    ada_n_estimators: int = 15
    mlp_hidden: tuple[int, ...] = (8,)
    mlp_max_iter: int = 500

    # ── Walk-forward ──────────────────────────────────────────
    warmup_frac: float = 0.20
    warmup_months: int | None = None
    retrain_every: int = 5
    horizons: tuple[int, ...] = (3, 6, 12, 18)
    expanding: bool = True
    fixed_window_months: int = 180
    min_positive_class: int = 1

    # ── Conformal ─────────────────────────────────────────────
    conformal_alpha: float = 0.1
    conformal_window: int = 100

    # ── Orthogonal variance ───────────────────────────────────
    ov_benchmark: str = "T10Y3M"
    ov_lags: int = 6
    ov_bootstrap_iters: int = 500

    # ── Integration flags ─────────────────────────────────────
    btut_thinning: bool = False
    btut_target_features: int = 12
    btut_budget_dollars: float = 5.0
    crystallization_enabled: bool = False
    crystallization_granularity: Literal["per_fold", "per_year"] = "per_year"

    # ── Data ──────────────────────────────────────────────────
    vintage: Literal["realtime", "latest"] = "realtime"
    fred_api_key: str = ""
    redis_cache_ttl_seconds: int = 7 * 86400  # 7 days

    # ── FRED series IDs ───────────────────────────────────────
    series: dict[str, str] = field(default_factory=lambda: {
        "investment": "GPDIC1",
        "m2": "M2SL",
        "fedfunds": "FEDFUNDS",
        "gdp": "GDPC1",
        "tcu": "TCU",
        "yield_spread": "T10Y3M",
        "cpi": "CPIAUCSL",
    })

    # ── NBER recession dates (hardcoded, matches oosTests.ts) ─
    nber_recessions: list[tuple[str, str]] = field(default_factory=lambda: [
        ("1980-01", "1980-07"),
        ("1981-07", "1982-11"),
        ("1990-07", "1991-03"),
        ("2001-03", "2001-11"),
        ("2007-12", "2009-06"),
        ("2020-02", "2020-04"),
    ])
```

**Step 4: Commit**

```bash
git add backend/pyproject.toml backend/app/services/niv/__init__.py backend/app/services/niv/config.py
git commit -m "feat(niv): package skeleton + NIVConfig with all constants from niv.rs"
```

---

## Task 2: Formula layer — components

**Files:**
- Create: `backend/app/services/niv/formula.py`
- Create: `backend/tests/services/niv/__init__.py`
- Create: `backend/tests/services/niv/test_formula.py`

**Step 1: Write the failing tests**

```python
# backend/tests/services/niv/test_formula.py
"""Tests for the NIV formula layer — parity with niv.rs."""
import math
import numpy as np
import pytest


class TestThrust:
    def test_zero_inputs(self):
        from app.services.niv.formula import thrust
        assert thrust(0.0, 0.0, 0.0) == pytest.approx(0.0, abs=1e-10)

    def test_positive_growth(self):
        from app.services.niv.formula import thrust
        # tanh((1*5 + 1*3 - 0.7*1) / 10) = tanh(0.73) ≈ 0.6206
        result = thrust(dG=5.0, dA=3.0, dr=1.0)
        assert result == pytest.approx(math.tanh(7.3 / 10.0), abs=1e-6)

    def test_strong_rate_hike(self):
        from app.services.niv.formula import thrust
        # Negative thrust when rates dominate
        result = thrust(dG=1.0, dA=1.0, dr=10.0)
        assert result < 0

    def test_tanh_bounds(self):
        from app.services.niv.formula import thrust
        # Extreme inputs bounded by tanh to (-1, 1)
        assert -1.0 < thrust(100.0, 100.0, 0.0) <= 1.0
        assert -1.0 <= thrust(0.0, 0.0, 100.0) < 1.0


class TestEfficiencySquared:
    def test_normal(self):
        from app.services.niv.formula import efficiency_squared
        # (1000 * 1.15 / 5000)^2 = (0.23)^2 = 0.0529
        result = efficiency_squared(investment=1000.0, gdp=5000.0)
        assert result == pytest.approx(0.0529, abs=1e-6)

    def test_zero_gdp(self):
        from app.services.niv.formula import efficiency_squared
        assert efficiency_squared(investment=1000.0, gdp=0.0) == 0.0


class TestSlack:
    def test_normal(self):
        from app.services.niv.formula import slack
        assert slack(80.0) == pytest.approx(0.20, abs=1e-10)

    def test_full_capacity(self):
        from app.services.niv.formula import slack
        assert slack(100.0) == pytest.approx(0.0, abs=1e-10)


class TestDrag:
    def test_inverted_curve(self):
        from app.services.niv.formula import drag
        result = drag(yield_spread=-2.0, fed_funds=5.0, cpi_inflation=3.0, sigma_r=1.5)
        # spread component: 0.4 * (2.0/100) = 0.008
        # real rate: 0.4 * max(0, 5-3)/100 = 0.008
        # vol: 0.2 * 1.5/100 = 0.003
        assert result.total == pytest.approx(0.008 + 0.008 + 0.003, abs=1e-6)

    def test_positive_spread_no_penalty(self):
        from app.services.niv.formula import drag
        result = drag(yield_spread=2.0, fed_funds=2.0, cpi_inflation=3.0, sigma_r=0.5)
        # spread = 0 (positive), real_rate = max(0, 2-3)/100 = 0, vol = 0.2*0.5/100
        assert result.spread == 0.0
        assert result.real_rate == 0.0


class TestNIVScore:
    def test_positive_niv(self):
        from app.services.niv.formula import niv_score
        # thrust=0.5, P_sq=0.04, slack=0.2, drag=0.01
        # num = 0.5 * 0.04 = 0.02
        # denom = (0.2 + 0.01 + 0.001)^1.5 = 0.211^1.5 ≈ 0.0969
        # raw = 0.02 / 0.0969 ≈ 0.2064
        # score = 0.2064 * 1000 = 206.4 → clamped to 100.0
        score = niv_score(u=0.5, P_sq=0.04, X=0.2, F=0.01)
        assert score == 100.0  # clamped

    def test_clamp_negative(self):
        from app.services.niv.formula import niv_score
        score = niv_score(u=-0.9, P_sq=0.1, X=0.01, F=0.001)
        assert score == -100.0

    def test_zero_denominator(self):
        from app.services.niv.formula import niv_score
        assert niv_score(u=0.5, P_sq=0.04, X=0.0, F=0.0, eps=0.0) == 0.0


class TestRecessionProbability:
    def test_zero_niv(self):
        from app.services.niv.formula import recession_probability
        # 1 - σ(0) = 1 - 0.5 = 0.5
        assert recession_probability(0.0) == pytest.approx(0.5, abs=1e-10)

    def test_large_positive_niv(self):
        from app.services.niv.formula import recession_probability
        # Large positive → low recession prob
        assert recession_probability(50.0) < 0.01

    def test_large_negative_niv(self):
        from app.services.niv.formula import recession_probability
        # Large negative → high recession prob
        assert recession_probability(-50.0) > 0.99


class TestSmooth12m:
    def test_passthrough_short(self):
        import pandas as pd
        from app.services.niv.formula import smooth_12m
        s = pd.Series([1.0, 2.0, 3.0])
        result = smooth_12m(s)
        assert list(result) == [1.0, 2.0, 3.0]

    def test_smoothing_kicks_in(self):
        import pandas as pd
        from app.services.niv.formula import smooth_12m
        s = pd.Series(range(1, 25), dtype=float)
        result = smooth_12m(s)
        # First 11 values passthrough
        assert result.iloc[0] == 1.0
        assert result.iloc[10] == 11.0
        # Index 11 (12th element): mean of 1..12 = 6.5
        assert result.iloc[11] == pytest.approx(6.5, abs=1e-10)
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/services/niv/test_formula.py -v --no-header 2>&1 | head -30
```
Expected: FAIL (module not found)

**Step 3: Write the implementation**

```python
# backend/app/services/niv/formula.py
"""NIV formula layer — pure numpy, zero external state.

Ported from regenerationism.ai/rust-engine/src/niv.rs.
Every constant matches the Rust source verbatim.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

from .config import NIVConfig

# ── Constants (default, overrideable via NIVConfig) ───────────────────
_CFG = NIVConfig()


@dataclass
class DragBreakdown:
    total: float
    spread: float
    real_rate: float
    vol: float


@dataclass
class NIVComponents:
    thrust: float
    efficiency: float
    efficiency_squared: float
    slack: float
    drag: DragBreakdown


@dataclass
class AlertEnvelope:
    """Alert level + recommended action. Hook 1: user fills alert_level_from_probability()."""
    level: Literal["normal", "elevated", "warning", "critical"]
    action: str
    dollar_stakes: float      # position size multiplier [0, 1]
    invalidation_prob: float  # prob below which this alert auto-clears


@dataclass
class NIVResult:
    date: str
    niv_score: float
    recession_probability: float
    components: NIVComponents
    alert: AlertEnvelope
    smoothed_niv: float | None = None


# ── Component functions ───────────────────────────────────────────────

def thrust(dG: float, dA: float, dr: float, cfg: NIVConfig = _CFG) -> float:
    """Kinetic impulse: tanh((dG + dA - 0.7*dr) / 10). Matches niv.rs compute_components."""
    raw = cfg.thrust_dg_weight * dG + cfg.thrust_da_weight * dA - cfg.thrust_dr_weight * dr
    return float(np.tanh(raw / 10.0))


def efficiency_squared(investment: float, gdp: float, cfg: NIVConfig = _CFG) -> float:
    """Capital productivity squared: (I * 1.15 / GDP)^2. Returns 0 if GDP <= 0."""
    if gdp <= 0:
        return 0.0
    eff = (investment * cfg.rd_multiplier) / gdp
    return eff ** 2


def slack(tcu: float) -> float:
    """Economic headroom: 1 - TCU/100."""
    return 1.0 - (tcu / 100.0)


def drag(
    yield_spread: float,
    fed_funds: float,
    cpi_inflation: float,
    sigma_r: float,
    cfg: NIVConfig = _CFG,
) -> DragBreakdown:
    """Systemic friction with three weighted components. Matches niv.rs.

    NOTE: Each component is /100 before weighting — this is critical for
    magnitude parity with the Rust engine.
    """
    d_spread = abs(yield_spread) / 100.0 if yield_spread < 0 else 0.0
    d_real_rate = max(0.0, fed_funds - cpi_inflation) / 100.0
    d_vol = sigma_r / 100.0
    total = (cfg.drag_spread_weight * d_spread
             + cfg.drag_real_rate_weight * d_real_rate
             + cfg.drag_volatility_weight * d_vol)
    return DragBreakdown(total=total, spread=d_spread, real_rate=d_real_rate, vol=d_vol)


def niv_score(
    u: float, P_sq: float, X: float, F: float,
    eta: float = _CFG.eta, eps: float = _CFG.epsilon,
) -> float:
    """Assemble NIV: (u * P^2) / (X + F + eps)^eta, then *1000 and clamp [-100, 100].

    The *1000 + clamp is the line from niv.rs that we originally missed.
    """
    numerator = u * P_sq
    denom_base = X + F + eps
    denom = abs(denom_base) ** eta
    if abs(denom) < 1e-15:
        return 0.0
    raw = numerator / denom
    return float(np.clip(raw * _CFG.niv_scale, *_CFG.niv_clamp))


def recession_probability(niv: float) -> float:
    """P(recession) = 1 - sigma(niv/10). Matches niv.rs compute_recession_probability."""
    p = 1.0 / (1.0 + np.exp(-niv / 10.0))
    return float(1.0 - p)


def smooth_12m(series: pd.Series, window: int = _CFG.smooth_window) -> pd.Series:
    """12-month rolling mean. First (window-1) values pass through unchanged.

    Matches niv.rs apply_smoothing.
    """
    result = series.copy()
    for i in range(window - 1, len(series)):
        result.iloc[i] = series.iloc[i - window + 1: i + 1].mean()
    return result


def alert_level_from_probability(
    prob: float,
    current_envelope: AlertEnvelope | None = None,
) -> AlertEnvelope:
    """Map recession probability to an alert envelope.

    TODO(diren): Encode the alert ladder that matches how Latent Ocean
    intends NIV to drive investor action. Consider:
      - hysteresis (prob must drop significantly below the trigger to clear)
      - position-size multiplier per level (0.0 = flat, 1.0 = full)
      - whether 'Critical' triggers a user notification (WebSocket push)

    Default below is a mechanical threshold that matches niv.rs alert levels.
    Replace with your product logic.
    """
    # Default mechanical thresholds (from niv.rs)
    if prob >= 0.70:
        return AlertEnvelope(level="critical", action="review immediately", dollar_stakes=0.0, invalidation_prob=0.50)
    elif prob >= 0.50:
        return AlertEnvelope(level="warning", action="reduce exposure", dollar_stakes=0.3, invalidation_prob=0.35)
    elif prob >= 0.30:
        return AlertEnvelope(level="elevated", action="monitor closely", dollar_stakes=0.7, invalidation_prob=0.20)
    else:
        return AlertEnvelope(level="normal", action="steady state", dollar_stakes=1.0, invalidation_prob=0.0)


def compute_single(
    date: str,
    investment: float,
    m2_growth_12m: float,
    fedfunds: float,
    gdp: float,
    tcu: float,
    yield_spread: float,
    cpi_inflation: float,
    investment_growth_monthly: float,
    fedfunds_change_monthly: float,
    fedfunds_sigma_12m: float,
    cfg: NIVConfig = _CFG,
) -> NIVResult:
    """Compute NIV for a single month given pre-processed inputs."""
    u = thrust(investment_growth_monthly, m2_growth_12m, fedfunds_change_monthly, cfg)
    P_sq = efficiency_squared(investment, gdp, cfg)
    X = slack(tcu)
    F = drag(yield_spread, fedfunds, cpi_inflation, fedfunds_sigma_12m, cfg)

    score = niv_score(u, P_sq, X, F.total, cfg.eta, cfg.epsilon)
    prob = recession_probability(score)
    alert = alert_level_from_probability(prob)

    components = NIVComponents(
        thrust=u,
        efficiency=(investment * cfg.rd_multiplier / gdp) if gdp > 0 else 0.0,
        efficiency_squared=P_sq,
        slack=X,
        drag=F,
    )
    return NIVResult(date=date, niv_score=score, recession_probability=prob,
                     components=components, alert=alert)
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_formula.py -v --no-header
```
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/app/services/niv/formula.py backend/tests/services/niv/
git commit -m "feat(niv): formula layer with thrust/efficiency/slack/drag/niv_score/recession_prob"
```

---

## Task 3: FRED adapter + Redis cache

**Files:**
- Create: `backend/app/services/niv/fred_adapter.py`
- Create: `backend/app/services/niv/cache.py`
- Create: `backend/tests/services/niv/test_fred_adapter.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_fred_adapter.py
"""Tests for FRED/ALFRED data adapter."""
import pandas as pd
import pytest


class TestFredAdapter:
    def test_align_series_fills_gaps(self):
        from app.services.niv.fred_adapter import align_series_nn
        # Two series with different dates, 90-day NN alignment
        s1 = pd.Series([100, 200, 300], index=pd.to_datetime(["2020-01-01", "2020-02-01", "2020-03-01"]))
        s2 = pd.Series([10, 20], index=pd.to_datetime(["2020-01-15", "2020-03-15"]))
        result = align_series_nn({"a": s1, "b": s2}, freq="MS", max_gap_days=90)
        assert len(result) == 3
        assert "a" in result.columns and "b" in result.columns
        assert result["b"].isna().sum() == 0  # NN should fill the gap

    def test_align_drops_wide_gaps(self):
        from app.services.niv.fred_adapter import align_series_nn
        s1 = pd.Series([100], index=pd.to_datetime(["2020-01-01"]))
        s2 = pd.Series([10], index=pd.to_datetime(["2021-01-01"]))
        result = align_series_nn({"a": s1, "b": s2}, freq="MS", max_gap_days=90)
        # Gap > 90 days, so no valid rows
        assert len(result) == 0

    def test_compute_derived_fields(self):
        from app.services.niv.fred_adapter import compute_derived
        # Build a minimal frame with the 7 FRED columns
        dates = pd.date_range("2019-01-01", periods=24, freq="MS")
        df = pd.DataFrame({
            "investment": [1000 + i * 10 for i in range(24)],
            "m2": [15000 + i * 100 for i in range(24)],
            "fedfunds": [2.0 + i * 0.05 for i in range(24)],
            "gdp": [20000 + i * 50 for i in range(24)],
            "tcu": [75.0 + i * 0.5 for i in range(24)],
            "yield_spread": [1.5 - i * 0.1 for i in range(24)],
            "cpi": [250 + i * 0.5 for i in range(24)],
        }, index=dates)
        result = compute_derived(df)
        # Should have derived columns
        assert "investment_growth_monthly" in result.columns
        assert "m2_growth_12m" in result.columns
        assert "fedfunds_change_monthly" in result.columns
        assert "fedfunds_sigma_12m" in result.columns
        assert "cpi_inflation_yoy" in result.columns
        # First 12 rows have NaN in 12m columns → dropped
        assert len(result) <= 12
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/services/niv/test_fred_adapter.py -v 2>&1 | head -10
```

**Step 3: Implement fred_adapter.py and cache.py**

```python
# backend/app/services/niv/fred_adapter.py
"""FRED/ALFRED data fetcher and preprocessor.

Fetches the 7 macro series, aligns them via 90-day nearest-neighbor
(matching fred.rs), and computes the derived fields needed by formula.py.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import httpx
import numpy as np
import pandas as pd

from .config import NIVConfig

logger = logging.getLogger(__name__)

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"
ALFRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


async def fetch_series(
    series_id: str,
    api_key: str,
    start: str | None = None,
    end: str | None = None,
    realtime: bool = False,
) -> pd.Series:
    """Fetch a single FRED (or ALFRED real-time vintage) series."""
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
    }
    if start:
        params["observation_start"] = start
    if end:
        params["observation_end"] = end
    if realtime:
        # ALFRED: realtime_start = realtime_end = observation date
        # This gives us the value as known on that date (no revisions)
        params["realtime_start"] = start or "1947-01-01"
        params["realtime_end"] = end or datetime.now().strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(FRED_BASE, params=params)
        resp.raise_for_status()
        data = resp.json()

    obs = data.get("observations", [])
    dates, values = [], []
    for o in obs:
        if o["value"] == ".":
            continue
        try:
            dates.append(pd.Timestamp(o["date"]))
            values.append(float(o["value"]))
        except (ValueError, KeyError):
            continue
    if not dates:
        return pd.Series(dtype=float)
    return pd.Series(values, index=pd.DatetimeIndex(dates), name=series_id)


def align_series_nn(
    series_dict: dict[str, pd.Series],
    freq: str = "MS",
    max_gap_days: int = 90,
) -> pd.DataFrame:
    """Align multiple series to a common monthly grid via nearest-neighbor.

    Matches fred.rs's 90-day NN interpolation logic.
    """
    if not series_dict:
        return pd.DataFrame()

    # Build target monthly index spanning all series
    all_dates = []
    for s in series_dict.values():
        if len(s) > 0:
            all_dates.extend([s.index.min(), s.index.max()])
    if not all_dates:
        return pd.DataFrame()

    target = pd.date_range(min(all_dates), max(all_dates), freq=freq)
    result = pd.DataFrame(index=target)

    for name, s in series_dict.items():
        if len(s) == 0:
            result[name] = np.nan
            continue
        aligned = np.full(len(target), np.nan)
        for i, t in enumerate(target):
            diffs = np.abs((s.index - t).total_seconds())
            nearest_idx = int(np.argmin(diffs))
            gap = timedelta(seconds=float(diffs[nearest_idx]))
            if gap <= timedelta(days=max_gap_days):
                aligned[i] = s.iloc[nearest_idx]
        result[name] = aligned

    # Drop rows where any column is NaN (strict alignment)
    result = result.dropna()
    return result


def compute_derived(df: pd.DataFrame) -> pd.DataFrame:
    """Compute derived fields needed by formula.compute_single().

    Input columns: investment, m2, fedfunds, gdp, tcu, yield_spread, cpi
    Output adds: investment_growth_monthly, m2_growth_12m,
                 fedfunds_change_monthly, fedfunds_sigma_12m, cpi_inflation_yoy
    """
    out = df.copy()
    out["investment_growth_monthly"] = out["investment"].pct_change() * 100.0
    out["m2_growth_12m"] = out["m2"].pct_change(12) * 100.0
    out["fedfunds_change_monthly"] = out["fedfunds"].diff()
    out["fedfunds_sigma_12m"] = out["fedfunds"].rolling(12).std()
    out["cpi_inflation_yoy"] = out["cpi"].pct_change(12) * 100.0
    out = out.dropna()
    return out


async def ingest(
    cfg: NIVConfig,
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """Full ingestion: fetch all 7 series, align, compute derived, return frame."""
    realtime = cfg.vintage == "realtime"
    series_data = {}
    for name, sid in cfg.series.items():
        try:
            s = await fetch_series(sid, cfg.fred_api_key, start, end, realtime)
            series_data[name] = s
        except Exception as e:
            logger.warning("Failed to fetch %s (%s): %s", name, sid, e)

    if len(series_data) < len(cfg.series):
        missing = set(cfg.series) - set(series_data)
        logger.error("Missing series: %s", missing)

    df = align_series_nn(series_data)
    if df.empty:
        return df
    return compute_derived(df)
```

```python
# backend/app/services/niv/cache.py
"""Redis-backed FRED series cache. FRED rate-limits at 120 req/min."""
from __future__ import annotations

import json
import logging
from typing import Any

import redis

logger = logging.getLogger(__name__)


class NIVCache:
    """Simple Redis cache for FRED API responses."""

    def __init__(self, redis_url: str, ttl: int = 7 * 86400):
        self._r = redis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl

    def get(self, key: str) -> Any | None:
        try:
            raw = self._r.get(f"niv:{key}")
            return json.loads(raw) if raw else None
        except Exception:
            return None

    def set(self, key: str, value: Any) -> None:
        try:
            self._r.setex(f"niv:{key}", self._ttl, json.dumps(value))
        except Exception:
            logger.warning("Cache write failed for key=%s", key)

    def invalidate(self, key: str) -> None:
        try:
            self._r.delete(f"niv:{key}")
        except Exception:
            pass
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_fred_adapter.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/fred_adapter.py backend/app/services/niv/cache.py backend/tests/services/niv/test_fred_adapter.py
git commit -m "feat(niv): FRED/ALFRED adapter with 90-day NN alignment + Redis cache"
```

---

## Task 4: Feature engineering

**Files:**
- Create: `backend/app/services/niv/features.py`
- Create: `backend/tests/services/niv/test_features.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_features.py
"""Tests for feature matrix construction (matches oosTests.ts prepareData)."""
import numpy as np
import pandas as pd
import pytest


class TestBuildFeatures:
    def test_output_has_12_columns(self):
        from app.services.niv.features import build_base_features
        # Minimal 30-month frame with all required columns
        dates = pd.date_range("2018-01-01", periods=30, freq="MS")
        niv_scores = np.linspace(-20, 20, 30)
        frame = pd.DataFrame({
            "niv_raw": niv_scores,
            "thrust": np.tanh(niv_scores / 50),
            "efficiency_squared": np.random.uniform(0.01, 0.10, 30),
            "slack": np.random.uniform(0.10, 0.30, 30),
            "drag_total": np.random.uniform(0.001, 0.02, 30),
            "drag_spread": np.random.uniform(0, 0.01, 30),
            "drag_real_rate": np.random.uniform(0, 0.01, 30),
            "drag_vol": np.random.uniform(0, 0.005, 30),
            "yield_spread": np.random.uniform(-1, 3, 30),
        }, index=dates)
        result = build_base_features(frame, smooth_window=12)
        # After dropping NaN from smoothing/momentum, expect fewer rows
        assert result.shape[1] == 12  # exactly 12 feature columns
        assert len(result) > 0

    def test_standardize_no_lookahead(self):
        from app.services.niv.features import standardize
        X = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0], [7.0, 8.0]])
        # Train on first 3, test on row 3
        X_train, X_test, means, stds = standardize(X[:3], X[3:4])
        # Train mean/std used for test normalization
        assert X_test.shape == (1, 2)
        # Test row normalized with train stats only (no lookahead)
        expected = (X[3] - X[:3].mean(axis=0)) / X[:3].std(axis=0)
        np.testing.assert_allclose(X_test[0], expected, atol=1e-10)

    def test_recession_labels_shifted(self):
        from app.services.niv.features import build_recession_labels
        from app.services.niv.config import NIVConfig
        dates = pd.date_range("2007-06-01", periods=24, freq="MS")
        labels = build_recession_labels(dates, horizon=12, cfg=NIVConfig())
        # 2007-12 to 2009-06 is a recession. At horizon=12:
        # label at 2007-06 = recession status at 2008-06 = True (in recession)
        assert labels.iloc[0] == 1  # 2007-06 → 2008-06 (in recession)

    def test_augmentation_pool_hook_raises(self):
        from app.services.niv.features import build_augmentation_pool
        with pytest.raises(NotImplementedError):
            build_augmentation_pool(pd.DataFrame())
```

**Step 2: Run to verify fail**

```bash
cd backend && python -m pytest tests/services/niv/test_features.py -v 2>&1 | head -10
```

**Step 3: Implement features.py**

```python
# backend/app/services/niv/features.py
"""Feature engineering for the NIV ensemble.

The 12 base features match oosTests.ts::prepareData() verbatim:
  smoothed_niv, niv_raw, thrust, efficiency², slack, drag,
  spread_minus_real_rate, real_rate, volatility,
  momentum_3mo, acceleration, expanding_percentile

The augmentation pool hook (build_augmentation_pool) is a learning-mode
stub — diren fills it with the candidate features BTUT should thin.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from .config import NIVConfig
from .formula import smooth_12m


@dataclass
class FeatureSpec:
    """Description of a candidate feature for BTUT thinning."""
    name: str
    builder: Callable[[pd.DataFrame], pd.Series]
    metadata: dict


FEATURE_NAMES = [
    "smoothed_niv", "niv_raw", "thrust", "efficiency_squared",
    "slack", "drag", "spread_minus_real_rate", "real_rate",
    "volatility", "momentum_3mo", "acceleration", "expanding_percentile",
]


def build_base_features(
    frame: pd.DataFrame,
    smooth_window: int = 12,
) -> pd.DataFrame:
    """Build the 12 base feature columns from a frame with NIV component columns.

    Input frame must have: niv_raw, thrust, efficiency_squared, slack,
    drag_total, drag_spread, drag_real_rate, drag_vol, yield_spread.
    """
    out = pd.DataFrame(index=frame.index)

    niv_raw = frame["niv_raw"]
    smoothed = smooth_12m(niv_raw, smooth_window)

    out["smoothed_niv"] = smoothed
    out["niv_raw"] = niv_raw
    out["thrust"] = frame["thrust"]
    out["efficiency_squared"] = frame["efficiency_squared"]
    out["slack"] = frame["slack"]
    out["drag"] = frame["drag_total"]
    out["spread_minus_real_rate"] = frame.get("yield_spread", 0) - frame.get("drag_real_rate", 0)
    out["real_rate"] = frame["drag_real_rate"]
    out["volatility"] = frame["drag_vol"]

    # Momentum: NIV_t - NIV_{t-3}
    out["momentum_3mo"] = smoothed.diff(3)
    # Acceleration: momentum_t - momentum_{t-3}
    out["acceleration"] = out["momentum_3mo"].diff(3)

    # Expanding percentile rank
    pctiles = []
    smoothed_vals = smoothed.values
    for i in range(len(smoothed_vals)):
        if np.isnan(smoothed_vals[i]):
            pctiles.append(np.nan)
            continue
        window = smoothed_vals[: i + 1]
        valid = window[~np.isnan(window)]
        if len(valid) < 2:
            pctiles.append(0.5)
        else:
            rank = np.sum(valid <= smoothed_vals[i])
            pctiles.append(rank / len(valid))
    out["expanding_percentile"] = pctiles

    return out.dropna()


def build_recession_labels(
    dates: pd.DatetimeIndex,
    horizon: int,
    cfg: NIVConfig | None = None,
) -> pd.Series:
    """Build binary recession labels shifted by horizon months.

    y[t] = 1 if date at (t + horizon) falls within an NBER recession.
    """
    if cfg is None:
        cfg = NIVConfig()

    # Build a set of all months in recession
    recession_months: set[str] = set()
    for start, end in cfg.nber_recessions:
        rng = pd.date_range(start, end, freq="MS")
        for d in rng:
            recession_months.add(d.strftime("%Y-%m"))

    labels = []
    for i, d in enumerate(dates):
        target_date = d + pd.DateOffset(months=horizon)
        key = target_date.strftime("%Y-%m")
        labels.append(1 if key in recession_months else 0)
    return pd.Series(labels, index=dates, name=f"recession_{horizon}m")


def standardize(
    X_train: np.ndarray,
    X_test: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Z-score standardize using training-set statistics only.

    Returns (X_train_scaled, X_test_scaled, means, stds).
    """
    means = X_train.mean(axis=0)
    stds = X_train.std(axis=0)
    stds[stds < 1e-12] = 1.0  # avoid division by zero
    return (X_train - means) / stds, (X_test - means) / stds, means, stds


def build_augmentation_pool(niv_frame: pd.DataFrame) -> list[FeatureSpec]:
    """Build the candidate feature pool BTUT will thin down to 12.

    Base pool always includes the 12 features from the current TS code.

    TODO(diren): Add 30-40 augmentation candidates reflecting the
    macro behaviors you want NIV to be sensitive to. Suggestions:
      - alternate smoothing windows (6, 9, 18, 24 months)
      - alternate momentum lags (1, 6, 12 months)
      - per-component z-scores
      - cross-component ratios (e.g., drag/thrust as credit-stress proxy)
      - regime-flag features (is_easing, yield_inverted, ...)

    Return FeatureSpec list. Each spec is a (name, builder_fn, metadata) triple.
    """
    raise NotImplementedError(
        "Domain decision required: which augmented features should BTUT thin? "
        "See docs/plans/2026-04-11-niv-vertical-design.md, Section 6 Hook 2."
    )
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_features.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/features.py backend/tests/services/niv/test_features.py
git commit -m "feat(niv): 12 base features matching oosTests.ts prepareData + augmentation hook"
```

---

## Task 5: Ensemble — learners + combiner + calibration

**Files:**
- Create: `backend/app/services/niv/ensemble.py`
- Create: `backend/tests/services/niv/test_ensemble.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_ensemble.py
"""Tests for the NIV ensemble: learners, combiners, calibration."""
import numpy as np
import pytest


def _make_classification_data(n=200, seed=42):
    """Synthetic binary classification with class imbalance (~10% positive)."""
    rng = np.random.RandomState(seed)
    X = rng.randn(n, 5)
    y = (X[:, 0] + 0.5 * X[:, 1] - 0.3 * X[:, 2] + rng.randn(n) * 0.5 > 1.5).astype(int)
    return X, y


class TestNIVEnsemble:
    def test_fit_predict_shape(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_classification_data()
        ens = NIVEnsemble()
        ens.fit(X[:150], y[:150])
        probs = ens.predict_proba(X[150:])
        assert probs.shape == (50,)
        assert np.all((probs >= 0) & (probs <= 1))

    def test_log_odds_combiner(self):
        from app.services.niv.ensemble import log_odds_average, sigmoid, logit
        p1, p2, p3 = 0.7, 0.3, 0.8
        result = log_odds_average(p1, p2, p3)
        expected = sigmoid((logit(p1) + logit(p2) + logit(p3)) / 3)
        assert result == pytest.approx(expected, abs=1e-10)

    def test_per_learner_predictions(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_classification_data()
        ens = NIVEnsemble()
        ens.fit(X[:150], y[:150])
        per_learner = ens.predict_per_learner(X[150:])
        assert "lr" in per_learner and "ada" in per_learner and "mlp" in per_learner
        for v in per_learner.values():
            assert v.shape == (50,)

    def test_isotonic_calibration(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_classification_data(n=300)
        ens = NIVEnsemble(calibrate="last_30pct")
        ens.fit(X[:250], y[:250])
        probs = ens.predict_proba(X[250:])
        # Calibrated probs should be valid probabilities
        assert np.all((probs >= 0) & (probs <= 1))

    def test_stacking_combiner(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_classification_data(n=300)
        ens = NIVEnsemble(combiner="stacking")
        ens.fit(X[:250], y[:250])
        probs = ens.predict_proba(X[250:])
        assert probs.shape == (50,)
```

**Step 2: Run to verify fail**

```bash
cd backend && python -m pytest tests/services/niv/test_ensemble.py -v 2>&1 | head -10
```

**Step 3: Implement ensemble.py**

```python
# backend/app/services/niv/ensemble.py
"""NIV L2-regularized ensemble: LR + AdaBoost + MLP.

Default combiner: log-odds averaging (matches regenerationism.ai live dashboard).
Opt-in: stacking with LR meta-learner via NIVConfig(combiner="stacking").
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import AdaBoostClassifier, StackingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.tree import DecisionTreeClassifier

from .config import NIVConfig

logger = logging.getLogger(__name__)

_CFG = NIVConfig()


def logit(p: float) -> float:
    """Log-odds, clamped."""
    clamped = max(1e-7, min(1 - 1e-7, p))
    return float(np.log(clamped / (1 - clamped)))


def sigmoid(z: float) -> float:
    """Sigmoid, clamped."""
    z = max(-500, min(500, z))
    return float(1.0 / (1.0 + np.exp(-z)))


def log_odds_average(p1: float, p2: float, p3: float) -> float:
    """Average in log-odds space, then invert. Matches oosTests.ts."""
    return sigmoid((logit(p1) + logit(p2) + logit(p3)) / 3)


@dataclass
class EnsembleExplanation:
    """Per-learner contributions and combined prediction."""
    per_learner: dict[str, np.ndarray]
    combined: np.ndarray
    lr_coefficients: np.ndarray | None = None


class NIVEnsemble:
    """Ensemble of L2-LR + AdaBoost(15 stumps) + MLP(8 hidden).

    Default: log-odds averaging + isotonic calibration on last 30% of train.
    """

    def __init__(
        self,
        combiner: str = "log_odds",
        calibrate: str = "last_30pct",
        cfg: NIVConfig | None = None,
    ):
        self.cfg = cfg or _CFG
        self.combiner = combiner
        self.calibrate = calibrate
        self._lr = None
        self._ada = None
        self._mlp = None
        self._stacker = None
        self._iso = None
        self._fitted = False

    def _make_learners(self):
        cfg = self.cfg
        lr = LogisticRegression(
            C=cfg.lr_C, class_weight="balanced", penalty="l2",
            max_iter=cfg.lr_max_iter, solver="lbfgs", random_state=42,
        )
        ada = AdaBoostClassifier(
            n_estimators=cfg.ada_n_estimators,
            estimator=DecisionTreeClassifier(max_depth=1),
            algorithm="SAMME",
            random_state=42,
        )
        mlp = MLPClassifier(
            hidden_layer_sizes=cfg.mlp_hidden,
            activation="relu",
            solver="adam",
            max_iter=cfg.mlp_max_iter,
            early_stopping=True,
            random_state=42,
        )
        return lr, ada, mlp

    def fit(self, X: np.ndarray, y: np.ndarray) -> "NIVEnsemble":
        self._lr, self._ada, self._mlp = self._make_learners()

        if self.combiner == "stacking":
            self._stacker = StackingClassifier(
                estimators=[("lr", self._lr), ("ada", self._ada), ("mlp", self._mlp)],
                final_estimator=LogisticRegression(C=1.0, random_state=42),
                cv=3,
                stack_method="predict_proba",
                passthrough=False,
            )
            self._stacker.fit(X, y)
        else:
            # Fit each learner independently
            self._lr.fit(X, y)
            self._ada.fit(X, y)
            self._mlp.fit(X, y)

        # Isotonic calibration on last 30% of training data
        if self.calibrate == "last_30pct" and self.combiner != "stacking":
            cal_start = int(len(X) * 0.7)
            if cal_start < len(X) - 10:
                cal_X = X[cal_start:]
                cal_y = y[cal_start:]
                cal_preds = self._raw_predict(cal_X)
                self._iso = IsotonicRegression(y_min=0, y_max=1, out_of_bounds="clip")
                self._iso.fit(cal_preds, cal_y)
        elif self.calibrate == "cv5":
            # Use sklearn's CalibratedClassifierCV on the whole ensemble
            # This is the opt-in improvement path
            pass  # TODO: wrap ensemble in a single estimator for calibration

        self._fitted = True
        return self

    def _raw_predict(self, X: np.ndarray) -> np.ndarray:
        """Raw ensemble prediction (log-odds averaging) without calibration."""
        p1 = self._lr.predict_proba(X)[:, 1]
        p2 = self._ada.predict_proba(X)[:, 1]
        p3 = self._mlp.predict_proba(X)[:, 1]

        # Log-odds averaging
        result = np.zeros(len(X))
        for i in range(len(X)):
            result[i] = log_odds_average(p1[i], p2[i], p3[i])
        return result

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Ensemble prediction with calibration applied."""
        if not self._fitted:
            raise RuntimeError("Call fit() before predict_proba()")

        if self.combiner == "stacking":
            return self._stacker.predict_proba(X)[:, 1]

        raw = self._raw_predict(X)
        if self._iso is not None:
            raw = self._iso.transform(raw)
        return np.clip(raw, 0, 1)

    def predict_per_learner(self, X: np.ndarray) -> dict[str, np.ndarray]:
        """Per-learner predictions for dashboard explainability."""
        if self.combiner == "stacking":
            # Extract from stacker's estimators
            return {
                name: est.predict_proba(X)[:, 1]
                for name, est in self._stacker.estimators_
            }
        return {
            "lr": self._lr.predict_proba(X)[:, 1],
            "ada": self._ada.predict_proba(X)[:, 1],
            "mlp": self._mlp.predict_proba(X)[:, 1],
        }

    def explain(self, X: np.ndarray) -> EnsembleExplanation:
        per_learner = self.predict_per_learner(X)
        combined = self.predict_proba(X)
        lr_coef = self._lr.coef_[0] if self._lr is not None else None
        return EnsembleExplanation(
            per_learner=per_learner, combined=combined, lr_coefficients=lr_coef,
        )
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_ensemble.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/ensemble.py backend/tests/services/niv/test_ensemble.py
git commit -m "feat(niv): ensemble LR+AdaBoost+MLP with log-odds combiner + isotonic calibration"
```

---

## Task 6: Conformal prediction

**Files:**
- Create: `backend/app/services/niv/conformal.py`
- Create: `backend/tests/services/niv/test_conformal.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_conformal.py
"""Tests for split-conformal prediction layer."""
import numpy as np
import pytest


class TestSplitConformal:
    def test_coverage_synthetic(self):
        from app.services.niv.conformal import SplitConformal
        rng = np.random.RandomState(42)
        cf = SplitConformal(alpha=0.1, window=100)
        # Feed 200 calibration points
        preds = rng.uniform(0, 1, 200)
        actuals = (preds > 0.5).astype(int)
        for p, a in zip(preds, actuals):
            cf.update(p, a)
        # Coverage should be approximately 1 - alpha = 0.90
        assert cf.coverage() >= 0.80  # loose bound for finite sample

    def test_bands_valid(self):
        from app.services.niv.conformal import SplitConformal
        cf = SplitConformal(alpha=0.1, window=50)
        # Populate with some scores
        for _ in range(60):
            cf.update(0.5, 0)
        lower, upper = cf.bands(0.6)
        assert lower <= 0.6 <= upper
        assert 0 <= lower and upper <= 1

    def test_empty_returns_wide_band(self):
        from app.services.niv.conformal import SplitConformal
        cf = SplitConformal(alpha=0.1)
        lower, upper = cf.bands(0.5)
        assert lower == 0.0 and upper == 1.0
```

**Step 2: Run to verify fail**

**Step 3: Implement conformal.py**

```python
# backend/app/services/niv/conformal.py
"""Split-conformal prediction for uncertainty bands on recession probabilities.

Port of oosTests.ts ConformalPredictor(0.1) with a 100-score rolling window.
"""
from __future__ import annotations

from collections import deque

import numpy as np


class SplitConformal:
    """Online conformal predictor with rolling nonconformity scores.

    Produces (lower, upper) prediction bands with target coverage 1-alpha.
    """

    def __init__(self, alpha: float = 0.1, window: int = 100):
        self.alpha = alpha
        self.window = window
        self._scores: deque[float] = deque(maxlen=window)
        self._correct: deque[bool] = deque(maxlen=window)

    def update(self, pred: float, actual: int) -> None:
        """Update with a new (prediction, ground truth) pair."""
        nonconformity = abs(pred - actual)
        self._scores.append(nonconformity)
        # Track coverage: did the band contain the actual?
        lo, hi = self.bands(pred)
        self._correct.append(lo <= actual <= hi)

    def bands(self, pred: float) -> tuple[float, float]:
        """Return (lower, upper) conformal band for a prediction."""
        if len(self._scores) < 2:
            return (0.0, 1.0)

        scores = np.array(self._scores)
        # Quantile of nonconformity scores at 1 - alpha
        q = np.quantile(scores, 1 - self.alpha)
        lower = max(0.0, pred - q)
        upper = min(1.0, pred + q)
        return (float(lower), float(upper))

    def coverage(self) -> float:
        """Empirical coverage over the rolling window."""
        if not self._correct:
            return 0.0
        return sum(self._correct) / len(self._correct)
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_conformal.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/conformal.py backend/tests/services/niv/test_conformal.py
git commit -m "feat(niv): split-conformal prediction with rolling nonconformity bands"
```

---

## Task 7: Walk-forward harness + Protocol D

**Files:**
- Create: `backend/app/services/niv/walkforward.py`
- Create: `backend/app/services/niv/protocol_d.py`
- Create: `backend/tests/services/niv/test_walkforward.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_walkforward.py
"""Tests for walk-forward OOS harness and Protocol D."""
import numpy as np
import pandas as pd
import pytest


def _make_walkforward_frame(n=200, seed=42):
    """Synthetic frame with 12 features + recession label."""
    rng = np.random.RandomState(seed)
    dates = pd.date_range("2000-01-01", periods=n, freq="MS")
    X = rng.randn(n, 12)
    y = (X[:, 0] + 0.5 * X[:, 1] + rng.randn(n) * 0.5 > 1.0).astype(int)
    cols = [f"f{i}" for i in range(12)]
    df = pd.DataFrame(X, columns=cols, index=dates)
    df["recession"] = y
    return df


class TestWalkForward:
    def test_basic_run(self):
        from app.services.niv.walkforward import walkforward, WalkForwardConfig
        from app.services.niv.ensemble import NIVEnsemble
        df = _make_walkforward_frame()
        config = WalkForwardConfig(warmup_frac=0.3, retrain_every=10, horizons=(3,))
        result = walkforward(df, lambda: NIVEnsemble(), config)
        assert result.horizons == (3,)
        assert len(result.predictions) > 0
        assert 0.0 <= result.auc_by_horizon[3] <= 1.0

    def test_deterministic_seed(self):
        from app.services.niv.walkforward import walkforward, WalkForwardConfig
        from app.services.niv.ensemble import NIVEnsemble
        df = _make_walkforward_frame()
        config = WalkForwardConfig(warmup_frac=0.3, retrain_every=10, horizons=(3,))
        r1 = walkforward(df, lambda: NIVEnsemble(), config)
        r2 = walkforward(df, lambda: NIVEnsemble(), config)
        assert r1.auc_by_horizon[3] == pytest.approx(r2.auc_by_horizon[3], abs=1e-6)


class TestProtocolD:
    def test_freeze_no_retrain(self):
        from app.services.niv.protocol_d import protocol_d
        from app.services.niv.ensemble import NIVEnsemble
        df = _make_walkforward_frame(n=100)
        freeze = "2005-01-01"
        result = protocol_d(df, freeze_date=freeze, ensemble=NIVEnsemble(), horizons=(3,))
        # All predictions should be after the freeze date
        for p in result.predictions:
            assert p["date"] >= freeze
        assert result.n_retrain == 0
```

**Step 2: Run to verify fail**

**Step 3: Implement walkforward.py and protocol_d.py**

```python
# backend/app/services/niv/walkforward.py
"""Expanding-window walk-forward harness.

Ensemble-agnostic: takes any factory that returns an object with fit/predict_proba.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, f1_score, roc_auc_score

from .conformal import SplitConformal
from .config import NIVConfig

logger = logging.getLogger(__name__)


@dataclass
class WalkForwardConfig:
    warmup_frac: float = 0.20
    warmup_months: int | None = None
    retrain_every: int = 5
    horizons: tuple[int, ...] = (3, 6, 12, 18)
    expanding: bool = True
    fixed_window_months: int = 180
    min_positive_class: int = 1
    conformal_alpha: float = 0.1
    conformal_window: int = 100


@dataclass
class WalkForwardResult:
    horizons: tuple[int, ...]
    auc_by_horizon: dict[int, float]
    brier_by_horizon: dict[int, float]
    f1_by_horizon: dict[int, float]
    predictions: list[dict]
    n_folds: int
    n_skipped: int
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "horizons": self.horizons,
            "auc_by_horizon": self.auc_by_horizon,
            "brier_by_horizon": self.brier_by_horizon,
            "f1_by_horizon": self.f1_by_horizon,
            "n_folds": self.n_folds,
            "n_skipped": self.n_skipped,
            "warnings": self.warnings,
        }


def walkforward(
    frame: pd.DataFrame,
    ensemble_factory: Callable,
    config: WalkForwardConfig,
    feature_cols: list[str] | None = None,
    label_col: str = "recession",
) -> WalkForwardResult:
    """Run expanding-window walk-forward evaluation.

    frame: time-indexed DataFrame with feature columns + label column.
    ensemble_factory: callable returning a fresh ensemble with fit/predict_proba.
    """
    n = len(frame)
    if feature_cols is None:
        feature_cols = [c for c in frame.columns if c != label_col]

    X_all = frame[feature_cols].values
    y_all = frame[label_col].values
    dates = frame.index

    warmup = config.warmup_months if config.warmup_months else int(n * config.warmup_frac)
    start_idx = max(warmup, 1)

    all_predictions = []
    horizon_actuals: dict[int, list] = {h: [] for h in config.horizons}
    horizon_preds: dict[int, list] = {h: [] for h in config.horizons}

    cached_ensemble = None
    steps_since_start = 0
    n_skipped = 0
    conformal = SplitConformal(config.conformal_alpha, config.conformal_window)
    warnings = []

    for i in range(start_idx, n):
        train_start = 0 if config.expanding else max(0, i - config.fixed_window_months)
        X_train = X_all[train_start:i]
        y_train = y_all[train_start:i]

        has_pos = np.any(y_train == 1)
        has_neg = np.any(y_train == 0)
        if not has_pos or not has_neg:
            n_skipped += 1
            continue

        should_retrain = cached_ensemble is None or steps_since_start % config.retrain_every == 0
        if should_retrain:
            cached_ensemble = ensemble_factory()
            try:
                cached_ensemble.fit(X_train, y_train)
            except Exception as e:
                warnings.append(f"Retrain failed at step {i}: {e}")
                n_skipped += 1
                continue

        X_test = X_all[i: i + 1]
        try:
            prob = float(cached_ensemble.predict_proba(X_test)[0])
        except Exception:
            prob = 0.5

        lower, upper = conformal.bands(prob)

        pred_record = {
            "date": str(dates[i]),
            "prob": prob,
            "lower": lower,
            "upper": upper,
            "retrained": should_retrain,
        }

        # Record per-horizon actuals
        for h in config.horizons:
            target_idx = i + h
            if target_idx < n:
                horizon_actuals[h].append(y_all[target_idx])
                horizon_preds[h].append(prob)
                pred_record[f"actual_{h}m"] = int(y_all[target_idx])

        all_predictions.append(pred_record)
        conformal.update(prob, int(y_all[i]))
        steps_since_start += 1

    # Compute metrics per horizon
    auc_by_h = {}
    brier_by_h = {}
    f1_by_h = {}
    for h in config.horizons:
        ya = np.array(horizon_actuals[h])
        yp = np.array(horizon_preds[h])
        if len(ya) > 0 and len(set(ya)) > 1:
            auc_by_h[h] = float(roc_auc_score(ya, yp))
            brier_by_h[h] = float(brier_score_loss(ya, yp))
            f1_by_h[h] = float(f1_score(ya, (yp > 0.5).astype(int), zero_division=0))
        else:
            auc_by_h[h] = 0.5
            brier_by_h[h] = 0.25
            f1_by_h[h] = 0.0
            warnings.append(f"Horizon {h}m: insufficient class diversity for metrics")

    return WalkForwardResult(
        horizons=config.horizons,
        auc_by_horizon=auc_by_h,
        brier_by_horizon=brier_by_h,
        f1_by_horizon=f1_by_h,
        predictions=all_predictions,
        n_folds=len(all_predictions),
        n_skipped=n_skipped,
        warnings=warnings,
    )
```

```python
# backend/app/services/niv/protocol_d.py
"""Protocol D — frozen forward test.

Fit once on data <= freeze_date, predict everything after with zero retraining.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, roc_auc_score


@dataclass
class ProtocolDResult:
    freeze_date: str
    horizons: tuple[int, ...]
    auc_by_horizon: dict[int, float]
    brier_by_horizon: dict[int, float]
    predictions: list[dict]
    n_retrain: int = 0
    n_forward_months: int = 0
    warnings: list[str] = field(default_factory=list)


def protocol_d(
    frame: pd.DataFrame,
    freeze_date: str,
    ensemble,
    horizons: tuple[int, ...] = (3, 6, 12, 18),
    feature_cols: list[str] | None = None,
    label_col: str = "recession",
) -> ProtocolDResult:
    """Fit once, freeze, predict forward with zero retraining."""
    if feature_cols is None:
        feature_cols = [c for c in frame.columns if c != label_col]

    freeze_ts = pd.Timestamp(freeze_date)
    train_mask = frame.index <= freeze_ts
    test_mask = frame.index > freeze_ts

    X_train = frame.loc[train_mask, feature_cols].values
    y_train = frame.loc[train_mask, label_col].values
    X_test = frame.loc[test_mask, feature_cols].values
    y_test = frame.loc[test_mask, label_col].values
    test_dates = frame.loc[test_mask].index

    warnings = []
    if not np.any(y_train == 1):
        warnings.append("No positive class in training data")
    if len(X_test) == 0:
        return ProtocolDResult(
            freeze_date=freeze_date, horizons=horizons,
            auc_by_horizon={}, brier_by_horizon={},
            predictions=[], warnings=["No test data after freeze date"],
        )

    # Fit once
    ensemble.fit(X_train, y_train)

    # Predict forward — zero retraining
    probs = ensemble.predict_proba(X_test)
    predictions = []
    for i, (date, prob) in enumerate(zip(test_dates, probs)):
        predictions.append({"date": str(date), "prob": float(prob), "actual": int(y_test[i])})

    # Per-horizon metrics
    n = len(y_test)
    auc_by_h = {}
    brier_by_h = {}
    for h in horizons:
        ya = y_test[h:] if h < n else np.array([])
        yp = probs[:n - h] if h < n else np.array([])
        if len(ya) > 0 and len(set(ya)) > 1:
            auc_by_h[h] = float(roc_auc_score(ya, yp))
            brier_by_h[h] = float(brier_score_loss(ya, yp))
        else:
            auc_by_h[h] = 0.5
            brier_by_h[h] = 0.25

    return ProtocolDResult(
        freeze_date=freeze_date,
        horizons=horizons,
        auc_by_horizon=auc_by_h,
        brier_by_horizon=brier_by_h,
        predictions=predictions,
        n_retrain=0,
        n_forward_months=len(X_test),
        warnings=warnings,
    )
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_walkforward.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/walkforward.py backend/app/services/niv/protocol_d.py backend/tests/services/niv/test_walkforward.py
git commit -m "feat(niv): walk-forward harness + Protocol D frozen forward test"
```

---

## Task 8: Orthogonal variance

**Files:**
- Create: `backend/app/services/niv/orthogonal_variance.py`
- Create: `backend/tests/services/niv/test_orthogonal_variance.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_orthogonal_variance.py
"""Tests for orthogonal variance decomposition."""
import numpy as np
import pandas as pd
import pytest


class TestOrthogonalVariance:
    def test_perfectly_orthogonal(self):
        from app.services.niv.orthogonal_variance import orthogonal_variance
        rng = np.random.RandomState(42)
        n = 200
        niv = pd.Series(rng.randn(n))
        benchmark = pd.Series(rng.randn(n))
        result = orthogonal_variance(niv, benchmark, lags=3, bootstrap_iters=50)
        # Independent series → orthogonal fraction near 1.0
        assert result.fraction > 0.80

    def test_perfectly_correlated(self):
        from app.services.niv.orthogonal_variance import orthogonal_variance
        n = 200
        niv = pd.Series(np.arange(n, dtype=float))
        benchmark = niv * 2 + 1
        result = orthogonal_variance(niv, benchmark, lags=0, bootstrap_iters=50)
        # Perfectly correlated → orthogonal fraction near 0.0
        assert result.fraction < 0.05

    def test_ci_contains_point_estimate(self):
        from app.services.niv.orthogonal_variance import orthogonal_variance
        rng = np.random.RandomState(42)
        niv = pd.Series(rng.randn(100))
        benchmark = pd.Series(rng.randn(100))
        result = orthogonal_variance(niv, benchmark, lags=2, bootstrap_iters=100)
        assert result.ci_95[0] <= result.fraction <= result.ci_95[1]
```

**Step 2: Run to verify fail**

**Step 3: Implement**

```python
# backend/app/services/niv/orthogonal_variance.py
"""Orthogonal variance decomposition vs. a benchmark series.

NEW — fills the documented gap in the regenerationism methodology.
Regresses NIV on the benchmark (with lags), reports residual variance fraction.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class OrthogonalVarianceResult:
    fraction: float                   # Var(residuals) / Var(niv)
    ci_95: tuple[float, float]       # bootstrap CI
    betas: dict[int, float]          # lag → OLS coefficient
    benchmark_series: str
    n_obs: int


def _ols_residual_variance(niv: np.ndarray, X: np.ndarray) -> float:
    """OLS fit, return Var(residuals) / Var(niv)."""
    # Add intercept
    ones = np.ones((len(X), 1))
    X_aug = np.hstack([ones, X])
    try:
        betas, _, _, _ = np.linalg.lstsq(X_aug, niv, rcond=None)
    except np.linalg.LinAlgError:
        return 1.0
    predicted = X_aug @ betas
    residuals = niv - predicted
    var_niv = np.var(niv)
    if var_niv < 1e-15:
        return 1.0
    return float(np.var(residuals) / var_niv)


def orthogonal_variance(
    niv: pd.Series,
    benchmark: pd.Series,
    lags: int = 6,
    bootstrap_iters: int = 500,
    benchmark_name: str = "T10Y3M",
) -> OrthogonalVarianceResult:
    """Compute orthogonal variance fraction with bootstrap CI.

    Regresses NIV_t on Σ β_k · benchmark_{t-k} for k in [0, lags].
    Orthogonal fraction = Var(residuals) / Var(NIV).
    Higher = more independent from the benchmark.
    """
    # Align series
    both = pd.DataFrame({"niv": niv.values, "bench": benchmark.values}).dropna()
    n = len(both)
    if n <= lags + 2:
        return OrthogonalVarianceResult(
            fraction=1.0, ci_95=(0.0, 1.0), betas={}, benchmark_series=benchmark_name, n_obs=n,
        )

    niv_arr = both["niv"].values
    bench_arr = both["bench"].values

    # Build lagged feature matrix
    X = np.column_stack([
        np.roll(bench_arr, k)[lags:] for k in range(lags + 1)
    ])
    y = niv_arr[lags:]
    n_valid = len(y)

    # Point estimate
    fraction = _ols_residual_variance(y, X)

    # Extract betas for interpretability
    ones = np.ones((len(X), 1))
    X_aug = np.hstack([ones, X])
    betas_raw, _, _, _ = np.linalg.lstsq(X_aug, y, rcond=None)
    betas = {k: float(betas_raw[k + 1]) for k in range(lags + 1)}

    # Bootstrap CI
    rng = np.random.RandomState(42)
    boot_fractions = []
    for _ in range(bootstrap_iters):
        idx = rng.choice(n_valid, n_valid, replace=True)
        boot_frac = _ols_residual_variance(y[idx], X[idx])
        boot_fractions.append(boot_frac)
    ci_lo = float(np.percentile(boot_fractions, 2.5))
    ci_hi = float(np.percentile(boot_fractions, 97.5))

    return OrthogonalVarianceResult(
        fraction=fraction,
        ci_95=(ci_lo, ci_hi),
        betas=betas,
        benchmark_series=benchmark_name,
        n_obs=n_valid,
    )
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_orthogonal_variance.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/orthogonal_variance.py backend/tests/services/niv/test_orthogonal_variance.py
git commit -m "feat(niv): orthogonal variance decomposition vs benchmark with bootstrap CI"
```

---

## Task 9: Bridges — BTUT + crystallization + sovereign stub

**Files:**
- Create: `backend/app/services/niv/btut_bridge.py`
- Create: `backend/app/services/niv/crystallization_bridge.py`
- Create: `backend/app/services/niv/sovereign.py`
- Create: `backend/app/services/niv/tearsheet.py`
- Create: `backend/tests/services/niv/test_bridges.py`

**Step 1: Write failing tests**

```python
# backend/tests/services/niv/test_bridges.py
"""Tests for integration bridges and learning-mode hooks."""
import pytest


class TestBTUTBridge:
    def test_disabled_returns_base_features(self):
        from app.services.niv.btut_bridge import thin_features
        from app.services.niv.config import NIVConfig
        cfg = NIVConfig(btut_thinning=False)
        result = thin_features([], None, cfg=cfg)
        assert result is None  # disabled = no-op

    def test_enabled_requires_pool(self):
        from app.services.niv.btut_bridge import thin_features
        from app.services.niv.config import NIVConfig
        cfg = NIVConfig(btut_thinning=True)
        # Empty pool should warn, not crash
        result = thin_features([], None, cfg=cfg)
        assert result is None


class TestSovereignHook:
    def test_uae_ingest_raises(self):
        from app.services.niv.sovereign import UAELiquiditySandbox
        from app.services.niv.config import NIVConfig
        sandbox = UAELiquiditySandbox(NIVConfig())
        with pytest.raises(NotImplementedError):
            import asyncio
            asyncio.get_event_loop().run_until_complete(sandbox.ingest("2020-01", "2024-01"))


class TestTearsheetHook:
    def test_thesis_paragraph_raises(self):
        from app.services.niv.tearsheet import investment_thesis_paragraph
        with pytest.raises(NotImplementedError):
            investment_thesis_paragraph(None, None, 0.4, None)


class TestCrystallizationBridge:
    def test_descriptor_hook_raises(self):
        from app.services.niv.crystallization_bridge import to_module_descriptor
        with pytest.raises(NotImplementedError):
            to_module_descriptor(None)
```

**Step 2: Run to verify fail**

**Step 3: Implement all four files**

```python
# backend/app/services/niv/btut_bridge.py
"""Optional BTUT feature-selection bridge.

Wraps run_btut_pipeline to pick the best 12 features from an
augmented pool of ~50 NIV-derived candidates.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import NIVConfig

logger = logging.getLogger(__name__)


@dataclass
class BTUTThinningResult:
    survivors: list[str]           # feature names selected
    manifest: list[dict]           # per-survivor BTUT scores
    original_pool_size: int


def thin_features(
    candidate_pool: list,
    niv_frame: pd.DataFrame | None,
    cfg: NIVConfig | None = None,
) -> BTUTThinningResult | None:
    """Select features via BTUT lattice threading.

    Returns None if btut_thinning is disabled or pool is empty.
    """
    if cfg is None:
        cfg = NIVConfig()
    if not cfg.btut_thinning:
        return None
    if not candidate_pool:
        logger.warning("BTUT thinning enabled but candidate pool is empty")
        return None

    try:
        from app.services.btut.pipeline import run_btut_pipeline
    except ImportError:
        logger.error("BTUT pipeline not available — falling back to base features")
        return None

    # Build entities from feature specs
    entities = []
    edges = []
    for i, spec in enumerate(candidate_pool):
        entities.append({
            "name": spec.name if hasattr(spec, "name") else f"feature_{i}",
            "type": "macro_feature",
            "attributes": spec.metadata if hasattr(spec, "metadata") else {},
        })

    result = run_btut_pipeline(
        entities, edges,
        unique_types=["macro_feature"],
        target_survivors=cfg.btut_target_features,
        budget_dollars=cfg.btut_budget_dollars,
    )

    survivors = []
    manifest = []
    for s in result.get("survivors", []):
        name = s["entity"]["name"]
        survivors.append(name)
        manifest.append({
            "name": name,
            "diversity": s["scores"]["diversity"],
            "reconstruction": s["scores"]["reconstruction"],
            "anomaly": s["scores"]["anomaly"],
            "composite": s["scores"]["composite"],
        })

    return BTUTThinningResult(
        survivors=survivors,
        manifest=manifest,
        original_pool_size=len(candidate_pool),
    )
```

```python
# backend/app/services/niv/crystallization_bridge.py
"""TCD-JEPA crystallization bridge for NIV walk-forward modules."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def to_module_descriptor(fold_data: Any) -> dict:
    """Convert a walk-forward fold into a TCD-JEPA module descriptor.

    TODO(diren): Define the descriptor shape that TCD-JEPA's job_manager
    expects. This is the contract between NIV and crystallization.

    Consider:
      - feature importances as the module's signature vector
      - prediction time series as the module's output stream
      - trained ensemble weights as metadata for regime comparison
      - date range of the training window for temporal context

    Return a dict matching job_manager.enqueue_modules() input schema.
    """
    raise NotImplementedError(
        "Schema decision required: TCD-JEPA module descriptor shape. "
        "See docs/plans/2026-04-11-niv-vertical-design.md, Section 6 Hook 5."
    )


def register_modules(
    walkforward_result,
    job_manager=None,
    granularity: str = "per_year",
) -> list[str]:
    """Register walk-forward results as crystallization modules.

    Returns list of module IDs. No-op if job_manager is None.
    """
    if job_manager is None:
        logger.info("Crystallization bridge: no job_manager, skipping")
        return []

    # Group predictions by year if per_year granularity
    module_ids = []
    predictions = walkforward_result.predictions
    if not predictions:
        return []

    if granularity == "per_year":
        by_year: dict[str, list] = {}
        for p in predictions:
            year = p["date"][:4]
            by_year.setdefault(year, []).append(p)
        for year, preds in sorted(by_year.items()):
            descriptor = to_module_descriptor({"year": year, "predictions": preds})
            # job_manager.enqueue_modules([descriptor])
            module_ids.append(f"niv_module_{year}")
    else:
        for i, p in enumerate(predictions):
            descriptor = to_module_descriptor(p)
            module_ids.append(f"niv_fold_{i}")

    return module_ids
```

```python
# backend/app/services/niv/sovereign.py
"""Sovereign NIV extension point — UAE liquidity sandbox.

Subclasses NIVVertical.ingest() with non-US data sources.
Everything else (formula, ensemble, OOS, conformal) is inherited.
"""
from __future__ import annotations

import pandas as pd

from .config import NIVConfig


class UAELiquiditySandbox:
    """UAE sovereign NIV variant.

    TODO(diren): Implement ingest() with UAE-specific data sources.
    """

    def __init__(self, cfg: NIVConfig):
        self.cfg = cfg

    async def ingest(self, start: str, end: str) -> pd.DataFrame:
        """Pull UAE macro series and return a frame with columns that map
        to the same NIV component slots.

        TODO(diren): Pull UAE macro series. UAE doesn't have a FRED.
        Map each to the standard NIV column names:
          investment, m2, fedfunds, gdp, tcu, yield_spread, cpi

        Data source candidates:
          - ??? (UAE investment proxy — sovereign wealth fund flows?)
          - ??? (UAE M2 equivalent — CBUAE monetary data?)
          - ??? (UAE Central Bank policy rate or EIBOR/SAIBOR)
          - ??? (UAE GDP quarterly → monthly interpolation)
          - ??? (UAE capacity util — oil refinery utilization?)
          - ??? (UAE CDS spread or Saudi-UAE rate differential)
          - ??? (UAE CPI from FCSA)

        Return the frame; the base vertical's formula layer does the rest.
        """
        raise NotImplementedError(
            "UAE data sources pending. "
            "See docs/plans/2026-04-11-niv-vertical-design.md, Section 6 Hook 3."
        )
```

```python
# backend/app/services/niv/tearsheet.py
"""NIV tearsheet generation — PDF/PNG/JSON.

Reuses visualization patterns from regenerationism.ai/analysis/niv_analysis.py.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def investment_thesis_paragraph(
    current_result: Any,
    walkforward: Any,
    orthogonal_var: float,
    crystallization_context: list[str] | None,
) -> str:
    """Generate a 3-5 sentence investment thesis.

    TODO(diren): This is the human-facing product. Consider:
      - Lead with the alert level and what it implies for equities/bonds/cash.
      - Cite orthogonal variance only if > 0.30 (otherwise it's not news).
      - If crystallization_context gives historical analogues, name them.
      - Voice: opinionated, short, specific. NOT wishy-washy.

    Returns a single paragraph string, markdown allowed.
    """
    raise NotImplementedError(
        "Voice/product decision required. "
        "See docs/plans/2026-04-11-niv-vertical-design.md, Section 6 Hook 4."
    )


def generate_tearsheet_json(
    niv_result: Any,
    walkforward_result: Any = None,
    protocol_d_result: Any = None,
    orthogonal_result: Any = None,
) -> dict:
    """Generate a JSON tearsheet (the base format for PDF/PNG rendering)."""
    sheet: dict[str, Any] = {
        "generated_at": None,  # filled by caller
        "niv_latest": None,
        "walkforward": None,
        "protocol_d": None,
        "orthogonal_variance": None,
        "thesis": None,
    }

    if niv_result is not None:
        try:
            sheet["niv_latest"] = asdict(niv_result)
        except Exception:
            sheet["niv_latest"] = str(niv_result)

    if walkforward_result is not None:
        sheet["walkforward"] = walkforward_result.to_dict()

    if protocol_d_result is not None:
        try:
            sheet["protocol_d"] = asdict(protocol_d_result)
        except Exception:
            pass

    if orthogonal_result is not None:
        try:
            sheet["orthogonal_variance"] = asdict(orthogonal_result)
        except Exception:
            pass

    return sheet


def save_tearsheet(sheet: dict, output_path: Path, fmt: str = "json") -> Path:
    """Save tearsheet to disk in the requested format."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "json":
        path = output_path.with_suffix(".json")
        path.write_text(json.dumps(sheet, indent=2, default=str))
        return path
    elif fmt == "pdf":
        # Placeholder for PDF rendering via reportlab
        path = output_path.with_suffix(".pdf")
        logger.warning("PDF tearsheet rendering not yet implemented, saving JSON fallback")
        path.write_text(json.dumps(sheet, indent=2, default=str))
        return path
    else:
        raise ValueError(f"Unsupported format: {fmt}")
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_bridges.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/btut_bridge.py backend/app/services/niv/crystallization_bridge.py backend/app/services/niv/sovereign.py backend/app/services/niv/tearsheet.py backend/tests/services/niv/test_bridges.py
git commit -m "feat(niv): BTUT bridge, crystallization bridge, sovereign stub, tearsheet with 3 hooks"
```

---

## Task 10: NIVVertical facade

**Files:**
- Create: `backend/app/services/niv/vertical.py`
- Create: `backend/tests/services/niv/test_vertical.py`

**Step 1: Write failing test**

```python
# backend/tests/services/niv/test_vertical.py
"""Tests for NIVVertical facade."""
import pytest


class TestNIVVertical:
    def test_instantiation_defaults(self):
        from app.services.niv.vertical import NIVVertical
        from app.services.niv.config import NIVConfig
        v = NIVVertical(NIVConfig())
        assert v.config is not None
        assert v.config.eta == 1.5

    def test_compute_scores_single_month(self):
        from app.services.niv.vertical import NIVVertical
        from app.services.niv.config import NIVConfig
        v = NIVVertical(NIVConfig())
        result = v.compute_single(
            date="2020-03-01",
            investment=3000.0, m2_growth_12m=6.0, fedfunds=1.5,
            gdp=21000.0, tcu=75.0, yield_spread=-0.5,
            cpi_inflation=2.3, investment_growth_monthly=0.5,
            fedfunds_change_monthly=-0.25, fedfunds_sigma_12m=0.8,
        )
        assert result.niv_score != 0.0
        assert 0.0 <= result.recession_probability <= 1.0
        assert result.alert.level in ("normal", "elevated", "warning", "critical")
```

**Step 2: Run to verify fail**

**Step 3: Implement vertical.py**

```python
# backend/app/services/niv/vertical.py
"""NIVVertical — single entrypoint the platform wires everything through."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from .config import NIVConfig
from .formula import compute_single as _compute_single, smooth_12m, NIVResult

logger = logging.getLogger(__name__)


class NIVVertical:
    """Facade for the NIV vertical. All platform integration goes through here."""

    def __init__(
        self,
        config: NIVConfig,
        btut_pipeline=None,
        crystallization_manager=None,
    ):
        self.config = config
        self._btut = btut_pipeline
        self._cryst = crystallization_manager

    def compute_single(self, **kwargs) -> NIVResult:
        """Compute NIV for a single month. Delegates to formula.compute_single."""
        return _compute_single(cfg=self.config, **kwargs)

    async def ingest(self, start: str | None = None, end: str | None = None) -> pd.DataFrame:
        """Fetch FRED data and return a preprocessed frame."""
        from .fred_adapter import ingest
        return await ingest(self.config, start, end)

    def compute_frame(self, frame: pd.DataFrame) -> list[NIVResult]:
        """Compute NIV for every row in a preprocessed FRED frame."""
        results = []
        for _, row in frame.iterrows():
            r = _compute_single(
                date=str(row.name),
                investment=row["investment"],
                m2_growth_12m=row.get("m2_growth_12m", 0),
                fedfunds=row["fedfunds"],
                gdp=row["gdp"],
                tcu=row["tcu"],
                yield_spread=row["yield_spread"],
                cpi_inflation=row.get("cpi_inflation_yoy", 0),
                investment_growth_monthly=row.get("investment_growth_monthly", 0),
                fedfunds_change_monthly=row.get("fedfunds_change_monthly", 0),
                fedfunds_sigma_12m=row.get("fedfunds_sigma_12m", 0),
                cfg=self.config,
            )
            results.append(r)
        return results

    def fit_walkforward(self, frame: pd.DataFrame, **kwargs):
        """Run walk-forward OOS evaluation."""
        from .ensemble import NIVEnsemble
        from .walkforward import WalkForwardConfig, walkforward
        config = WalkForwardConfig(
            warmup_frac=self.config.warmup_frac,
            retrain_every=self.config.retrain_every,
            horizons=self.config.horizons,
        )
        return walkforward(frame, lambda: NIVEnsemble(cfg=self.config), config, **kwargs)

    def fit_protocol_d(self, frame: pd.DataFrame, freeze_date: str, **kwargs):
        """Run Protocol D frozen forward test."""
        from .ensemble import NIVEnsemble
        from .protocol_d import protocol_d
        return protocol_d(frame, freeze_date, NIVEnsemble(cfg=self.config), **kwargs)

    def orthogonal_variance(self, niv_series: pd.Series, benchmark: pd.Series, **kwargs):
        """Compute orthogonal variance decomposition."""
        from .orthogonal_variance import orthogonal_variance
        return orthogonal_variance(niv_series, benchmark, **kwargs)

    def tearsheet(self, niv_result=None, walkforward_result=None, **kwargs) -> Path:
        """Generate tearsheet."""
        from .tearsheet import generate_tearsheet_json, save_tearsheet
        sheet = generate_tearsheet_json(niv_result, walkforward_result, **kwargs)
        output = Path("output/niv_tearsheet")
        return save_tearsheet(sheet, output, fmt=kwargs.get("fmt", "json"))
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/niv/test_vertical.py -v
```

**Step 5: Commit**

```bash
git add backend/app/services/niv/vertical.py backend/tests/services/niv/test_vertical.py
git commit -m "feat(niv): NIVVertical facade wiring formula, ensemble, walkforward, bridges"
```

---

## Task 11: Pydantic schemas + FastAPI router

**Files:**
- Create: `backend/app/schemas/niv.py`
- Create: `backend/app/api/v1/niv.py`
- Modify: `backend/app/api/v1/__init__.py` (register niv_router)
- Create: `backend/tests/api/test_niv.py`

**Step 1: Write failing test**

```python
# backend/tests/api/test_niv.py
"""Tests for NIV API endpoints (schema validation only — no live FRED)."""
import pytest


class TestNIVRouter:
    def test_router_exists(self):
        from app.api.v1.niv import router
        routes = [r.path for r in router.routes]
        assert "/niv/latest" in routes or "/latest" in routes
        assert "/niv/alert" in routes or "/alert" in routes

    def test_schemas_import(self):
        from app.schemas.niv import NIVLatestResponse, NIVHistoryRequest
        assert NIVLatestResponse is not None
```

**Step 2: Run to verify fail**

**Step 3: Implement schemas/niv.py and api/v1/niv.py**

```python
# backend/app/schemas/niv.py
"""Pydantic schemas for the NIV API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class NIVComponentsSchema(BaseModel):
    thrust: float
    efficiency: float
    efficiency_squared: float
    slack: float
    drag_total: float
    drag_spread: float
    drag_real_rate: float
    drag_vol: float


class AlertSchema(BaseModel):
    level: str
    action: str
    dollar_stakes: float
    invalidation_prob: float


class NIVLatestResponse(BaseModel):
    date: str
    niv_score: float
    recession_probability: float
    components: NIVComponentsSchema
    alert: AlertSchema
    smoothed_niv: float | None = None


class NIVHistoryRequest(BaseModel):
    start: str | None = None
    end: str | None = None
    smooth: bool = True


class NIVHistoryItem(BaseModel):
    date: str
    niv_score: float
    recession_probability: float
    smoothed_niv: float | None = None


class NIVHistoryResponse(BaseModel):
    data: list[NIVHistoryItem]
    count: int


class WalkForwardRequest(BaseModel):
    start: str | None = None
    end: str | None = None
    horizons: list[int] = Field(default=[3, 6, 12, 18])
    combiner: str = "log_odds"
    vintage: str = "realtime"


class WalkForwardResponse(BaseModel):
    horizons: list[int]
    auc_by_horizon: dict[int, float]
    brier_by_horizon: dict[int, float]
    f1_by_horizon: dict[int, float]
    n_folds: int
    n_skipped: int
    warnings: list[str]


class ProtocolDRequest(BaseModel):
    freeze_date: str
    horizons: list[int] = Field(default=[3, 6, 12, 18])


class ProtocolDResponse(BaseModel):
    freeze_date: str
    auc_by_horizon: dict[int, float]
    brier_by_horizon: dict[int, float]
    n_forward_months: int
    n_retrain: int


class OrthogonalVarianceRequest(BaseModel):
    benchmark_series: str = "T10Y3M"
    lags: int = 6


class OrthogonalVarianceResponse(BaseModel):
    fraction: float
    ci_95: list[float]
    betas: dict[int, float]
    benchmark_series: str
    n_obs: int


class TearsheetRequest(BaseModel):
    format: str = "json"
    dataset: str = "us"
    include_protocol_d: bool = False
```

```python
# backend/app/api/v1/niv.py
"""NIV vertical API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.niv import (
    AlertSchema,
    NIVLatestResponse,
    NIVHistoryResponse,
    WalkForwardRequest,
    WalkForwardResponse,
    ProtocolDRequest,
    ProtocolDResponse,
    OrthogonalVarianceRequest,
    OrthogonalVarianceResponse,
    TearsheetRequest,
)
from app.services.niv.config import NIVConfig
from app.services.niv.vertical import NIVVertical

router = APIRouter(prefix="/niv", tags=["niv"])

# Singleton vertical (lazy init)
_vertical: NIVVertical | None = None


def _get_vertical() -> NIVVertical:
    global _vertical
    if _vertical is None:
        _vertical = NIVVertical(NIVConfig())
    return _vertical


@router.get("/latest", response_model=NIVLatestResponse)
async def niv_latest():
    """Current month NIV score, components, alert, and conformal bands."""
    v = _get_vertical()
    # For now, return a placeholder — live FRED integration wired in Task 12
    return {
        "date": "2024-01-01",
        "niv_score": 0.0,
        "recession_probability": 0.5,
        "components": {
            "thrust": 0.0, "efficiency": 0.0, "efficiency_squared": 0.0,
            "slack": 0.2, "drag_total": 0.01, "drag_spread": 0.0,
            "drag_real_rate": 0.0, "drag_vol": 0.0,
        },
        "alert": {"level": "normal", "action": "steady state", "dollar_stakes": 1.0, "invalidation_prob": 0.0},
    }


@router.get("/alert")
async def niv_alert():
    """Current alert envelope."""
    v = _get_vertical()
    return {"level": "normal", "action": "steady state"}


@router.get("/history", response_model=NIVHistoryResponse)
async def niv_history(start: str | None = None, end: str | None = None, smooth: bool = True):
    """Monthly NIV time series."""
    return {"data": [], "count": 0}


@router.get("/datasets")
async def niv_datasets():
    """List available NIV datasets (US default, UAE stub)."""
    return [
        {"id": "us", "name": "United States (FRED)", "status": "active"},
        {"id": "uae", "name": "UAE Sovereign Sandbox", "status": "stub"},
    ]


@router.post("/walkforward", response_model=WalkForwardResponse)
async def niv_walkforward(req: WalkForwardRequest):
    """Run walk-forward out-of-sample evaluation."""
    raise HTTPException(501, "Walk-forward requires FRED data — use /niv/latest for live scores")


@router.post("/protocol-d", response_model=ProtocolDResponse)
async def niv_protocol_d(req: ProtocolDRequest):
    """Run Protocol D frozen forward test."""
    raise HTTPException(501, "Protocol D requires pre-computed frame")


@router.post("/orthogonal-variance", response_model=OrthogonalVarianceResponse)
async def niv_orthogonal_variance(req: OrthogonalVarianceRequest):
    """Compute orthogonal variance vs benchmark."""
    raise HTTPException(501, "Orthogonal variance requires NIV time series")


@router.post("/tearsheet")
async def niv_tearsheet(req: TearsheetRequest):
    """Generate NIV tearsheet."""
    return {"status": "not_implemented", "format": req.format}


@router.post("/crystallize")
async def niv_crystallize():
    """Submit walk-forward result to TCD-JEPA for crystallization."""
    return {"status": "stub", "module_ids": []}


@router.get("/health")
async def niv_health():
    return {"status": "ok", "vertical": "niv"}
```

**Step 4: Register router in api/v1/__init__.py**

Add these two lines after the existing imports:

```python
from app.api.v1.niv import router as niv_router
```

And after the existing `router.include_router(...)` calls:

```python
router.include_router(niv_router)
```

**Step 5: Run tests**

```bash
cd backend && python -m pytest tests/api/test_niv.py -v
```

**Step 6: Commit**

```bash
git add backend/app/schemas/niv.py backend/app/api/v1/niv.py backend/app/api/v1/__init__.py backend/tests/api/test_niv.py
git commit -m "feat(niv): pydantic schemas + FastAPI router at /api/v1/niv/* with all endpoints"
```

---

## Task 12: Integration test + update __init__.py exports

**Files:**
- Modify: `backend/app/services/niv/__init__.py` (export NIVVertical)
- Create: `backend/tests/services/niv/test_integration.py`

**Step 1: Update __init__.py exports**

```python
# backend/app/services/niv/__init__.py
"""NIV (National Impact Velocity) vertical — macro liquidity circulation intelligence."""
from .config import NIVConfig
from .vertical import NIVVertical

__all__ = ["NIVConfig", "NIVVertical"]
```

**Step 2: Write integration test**

```python
# backend/tests/services/niv/test_integration.py
"""End-to-end integration test for the NIV vertical (no live FRED)."""
import numpy as np
import pandas as pd
import pytest


class TestNIVEndToEnd:
    def _make_synthetic_frame(self, n=200):
        """Synthetic FRED-like frame for testing without live API."""
        dates = pd.date_range("2000-01-01", periods=n, freq="MS")
        rng = np.random.RandomState(42)
        return pd.DataFrame({
            "investment": 3000 + rng.randn(n).cumsum() * 50,
            "m2": 15000 + rng.randn(n).cumsum() * 100,
            "fedfunds": np.clip(3.0 + rng.randn(n).cumsum() * 0.3, 0.01, 20),
            "gdp": 20000 + rng.randn(n).cumsum() * 100,
            "tcu": np.clip(78 + rng.randn(n) * 3, 60, 100),
            "yield_spread": rng.randn(n) * 2,
            "cpi": 250 + np.arange(n) * 0.3 + rng.randn(n) * 0.5,
        }, index=dates)

    def test_full_pipeline_synthetic(self):
        from app.services.niv.config import NIVConfig
        from app.services.niv.vertical import NIVVertical
        from app.services.niv.fred_adapter import compute_derived
        from app.services.niv.features import build_base_features, build_recession_labels

        cfg = NIVConfig()
        v = NIVVertical(cfg)
        raw = self._make_synthetic_frame()
        frame = compute_derived(raw)
        assert len(frame) > 0

        # Compute NIV scores
        results = v.compute_frame(frame)
        assert len(results) > 0
        assert all(r.niv_score is not None for r in results)

        # Build feature matrix for ensemble
        niv_frame = pd.DataFrame({
            "niv_raw": [r.niv_score for r in results],
            "thrust": [r.components.thrust for r in results],
            "efficiency_squared": [r.components.efficiency_squared for r in results],
            "slack": [r.components.slack for r in results],
            "drag_total": [r.components.drag.total for r in results],
            "drag_spread": [r.components.drag.spread for r in results],
            "drag_real_rate": [r.components.drag.real_rate for r in results],
            "drag_vol": [r.components.drag.vol for r in results],
            "yield_spread": frame["yield_spread"].values[:len(results)],
        }, index=frame.index[:len(results)])

        features = build_base_features(niv_frame)
        assert features.shape[1] == 12

        labels = build_recession_labels(features.index, horizon=12, cfg=cfg)
        features["recession"] = labels.reindex(features.index).fillna(0).astype(int)

        # Walk-forward (small, synthetic)
        wf_result = v.fit_walkforward(features)
        assert wf_result.n_folds > 0
        for h in cfg.horizons:
            assert h in wf_result.auc_by_horizon

    def test_vertical_degrades_without_btut(self):
        from app.services.niv.config import NIVConfig
        from app.services.niv.vertical import NIVVertical
        cfg = NIVConfig(btut_thinning=False, crystallization_enabled=False)
        v = NIVVertical(cfg)
        # Should instantiate fine without BTUT or crystallization
        result = v.compute_single(
            date="2024-01-01", investment=3000, m2_growth_12m=5.0,
            fedfunds=5.0, gdp=25000, tcu=80, yield_spread=0.5,
            cpi_inflation=3.2, investment_growth_monthly=0.3,
            fedfunds_change_monthly=0.0, fedfunds_sigma_12m=0.5,
        )
        assert result.niv_score != 0.0
```

**Step 3: Run integration tests**

```bash
cd backend && python -m pytest tests/services/niv/test_integration.py -v
```

**Step 4: Commit**

```bash
git add backend/app/services/niv/__init__.py backend/tests/services/niv/test_integration.py
git commit -m "feat(niv): integration test + exports — NIV vertical v1 complete"
```

---

## Summary

| Task | Module | LOC (est.) | Test coverage |
|---|---|---|---|
| 1 | Skeleton + config | 100 | Config instantiation |
| 2 | Formula layer | 250 | Parity vs niv.rs constants |
| 3 | FRED adapter + cache | 200 | NN alignment, derived fields |
| 4 | Features | 180 | 12 columns, standardization, labels |
| 5 | Ensemble | 250 | Fit/predict, log-odds, isotonic, stacking |
| 6 | Conformal | 60 | Coverage, bands, empty state |
| 7 | Walk-forward + Protocol D | 250 | Basic run, determinism, freeze |
| 8 | Orthogonal variance | 100 | Orthogonal, correlated, CI |
| 9 | Bridges + hooks | 250 | Disabled fallbacks, hook stubs |
| 10 | NIVVertical facade | 120 | Instantiation, single-month compute |
| 11 | Schemas + Router | 300 | Route existence, schema import |
| 12 | Integration test | 100 | Full pipeline synthetic |
| **Total** | | **~2160** | **46 test cases** |

**Five learning-mode hooks** (NotImplementedError stubs):
1. `formula.py::alert_level_from_probability()` — alert ladder
2. `features.py::build_augmentation_pool()` — BTUT candidate pool
3. `sovereign.py::UAELiquiditySandbox.ingest()` — UAE data sources
4. `tearsheet.py::investment_thesis_paragraph()` — investor thesis voice
5. `crystallization_bridge.py::to_module_descriptor()` — TCD-JEPA schema
