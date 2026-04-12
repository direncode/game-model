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
    """Alert level + recommended action."""
    level: Literal["normal", "elevated", "warning", "critical"]
    action: str
    dollar_stakes: float
    invalidation_prob: float


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
    """Kinetic impulse: tanh((dG + dA - 0.7*dr) / 10). Matches niv.rs."""
    raw = cfg.thrust_dg_weight * dG + cfg.thrust_da_weight * dA - cfg.thrust_dr_weight * dr
    return float(np.tanh(raw / 10.0))


def efficiency_squared(investment: float, gdp: float, cfg: NIVConfig = _CFG) -> float:
    """Capital productivity squared: (I * 1.15 / GDP)^2."""
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
    """Systemic friction. Each component is /100 before weighting (matches niv.rs)."""
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
    """NIV: (u * P^2) / (X + F + eps)^eta, then *1000 and clamp [-100, 100]."""
    numerator = u * P_sq
    denom_base = X + F + eps
    denom = abs(denom_base) ** eta
    if abs(denom) < 1e-15:
        return 0.0
    raw = numerator / denom
    return float(np.clip(raw * _CFG.niv_scale, *_CFG.niv_clamp))


def recession_probability(niv: float) -> float:
    """P(recession) = 1 - sigma(niv/10). Matches niv.rs."""
    p = 1.0 / (1.0 + np.exp(-niv / 10.0))
    return float(1.0 - p)


def smooth_12m(series: pd.Series, window: int = _CFG.smooth_window) -> pd.Series:
    """12-month rolling mean. First (window-1) values pass through."""
    result = series.copy()
    for i in range(window - 1, len(series)):
        result.iloc[i] = series.iloc[i - window + 1: i + 1].mean()
    return result


def alert_level_from_probability(
    prob: float,
    current_envelope: AlertEnvelope | None = None,
) -> AlertEnvelope:
    """Map recession probability to an alert envelope with hysteresis.

    Thresholds match niv.rs (30/50/70) for escalation.
    De-escalation requires probability to drop 10pp below the trigger
    (hysteresis band) to avoid whiplash on noisy months.

    Position sizing: dollar_stakes is a multiplier on equity allocation.
    0.0 = fully defensive (treasuries/cash), 1.0 = full risk-on.
    The curve is nonlinear — cuts exposure aggressively at Warning
    because the 50-70% band historically precedes sharp drawdowns.
    """
    # ── Hysteresis: if already in an elevated state, require a bigger
    #    drop before de-escalating (prevents monthly flip-flopping)
    if current_envelope is not None:
        hysteresis = 0.10  # 10pp band
        current = current_envelope.level
        if current == "critical" and prob >= 0.70 - hysteresis:
            return AlertEnvelope(level="critical", action="defensive: max duration bonds, reduce equity to 0",
                                 dollar_stakes=0.0, invalidation_prob=0.50)
        if current == "warning" and prob >= 0.50 - hysteresis:
            return AlertEnvelope(level="warning", action="reduce equity to 30%, overweight short-duration",
                                 dollar_stakes=0.3, invalidation_prob=0.35)
        if current == "elevated" and prob >= 0.30 - hysteresis:
            return AlertEnvelope(level="elevated", action="trim cyclicals, add quality factor tilt",
                                 dollar_stakes=0.7, invalidation_prob=0.20)

    # ── Fresh escalation (no hysteresis needed)
    if prob >= 0.70:
        return AlertEnvelope(
            level="critical",
            action="defensive: max duration bonds, reduce equity to 0",
            dollar_stakes=0.0,
            invalidation_prob=0.50,
        )
    elif prob >= 0.50:
        return AlertEnvelope(
            level="warning",
            action="reduce equity to 30%, overweight short-duration",
            dollar_stakes=0.3,
            invalidation_prob=0.35,
        )
    elif prob >= 0.30:
        return AlertEnvelope(
            level="elevated",
            action="trim cyclicals, add quality factor tilt",
            dollar_stakes=0.7,
            invalidation_prob=0.20,
        )
    else:
        return AlertEnvelope(
            level="normal",
            action="risk-on: full equity allocation, pro-cyclical tilt",
            dollar_stakes=1.0,
            invalidation_prob=0.0,
        )


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
