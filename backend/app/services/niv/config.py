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
