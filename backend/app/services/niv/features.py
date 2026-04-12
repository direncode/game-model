"""Feature engineering for the NIV ensemble.

The 12 base features match oosTests.ts::prepareData() verbatim.
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
    """Build the 12 base feature columns from a frame with NIV component columns."""
    out = pd.DataFrame(index=frame.index)

    niv_raw = frame["niv_raw"]
    smoothed = smooth_12m(niv_raw, smooth_window)

    out["smoothed_niv"] = smoothed
    out["niv_raw"] = niv_raw
    out["thrust"] = frame["thrust"]
    out["efficiency_squared"] = frame["efficiency_squared"]
    out["slack"] = frame["slack"]
    out["drag"] = frame["drag_total"]

    spread = frame.get("yield_spread", pd.Series(0, index=frame.index))
    real_rate = frame.get("drag_real_rate", pd.Series(0, index=frame.index))
    out["spread_minus_real_rate"] = spread - real_rate
    out["real_rate"] = real_rate
    out["volatility"] = frame["drag_vol"]

    out["momentum_3mo"] = smoothed.diff(3)
    out["acceleration"] = out["momentum_3mo"].diff(3)

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
            rank = float(np.sum(valid <= smoothed_vals[i]))
            pctiles.append(rank / len(valid))
    out["expanding_percentile"] = pctiles

    return out.dropna()


def build_recession_labels(
    dates: pd.DatetimeIndex,
    horizon: int,
    cfg: NIVConfig | None = None,
) -> pd.Series:
    """Build binary recession labels shifted by horizon months."""
    if cfg is None:
        cfg = NIVConfig()

    recession_months: set[str] = set()
    for start, end in cfg.nber_recessions:
        rng = pd.date_range(start, end, freq="MS")
        for d in rng:
            recession_months.add(d.strftime("%Y-%m"))

    labels = []
    for d in dates:
        target_date = d + pd.DateOffset(months=horizon)
        key = target_date.strftime("%Y-%m")
        labels.append(1 if key in recession_months else 0)
    return pd.Series(labels, index=dates, name=f"recession_{horizon}m")


def standardize(
    X_train: np.ndarray,
    X_test: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Z-score standardize using training-set statistics only."""
    means = X_train.mean(axis=0)
    stds = X_train.std(axis=0)
    stds[stds < 1e-12] = 1.0
    return (X_train - means) / stds, (X_test - means) / stds, means, stds


def build_augmentation_pool(niv_frame: pd.DataFrame) -> list[FeatureSpec]:
    """Build the candidate feature pool BTUT will thin down to 12.

    Strategy: the 12 base features from oosTests.ts PLUS ~38 augmentation
    candidates covering alternate time horizons, cross-component ratios,
    and regime flags. BTUT's diversity/reconstruction/anomaly scoring
    picks the 12 most informative from this 50-feature pool.

    Categories:
    1. Alternate smoothing windows (6, 9, 18, 24mo) — captures different
       cycle frequencies (inventory cycle vs. credit cycle vs. secular).
    2. Alternate momentum lags (1, 6, 12mo) — short-term vs. medium-term
       NIV velocity.
    3. Per-component z-scores — standardized components comparable across
       regimes with different absolute levels.
    4. Cross-component ratios — drag/thrust (credit stress), slack*efficiency
       (productive capacity), spread volatility interaction.
    5. Regime flags — binary indicators for yield inversion, easing, etc.
    """
    pool: list[FeatureSpec] = []

    # Base 12 (always included, BTUT may still rank them)
    for name in FEATURE_NAMES:
        if name in niv_frame.columns:
            pool.append(FeatureSpec(
                name=name,
                builder=lambda df, n=name: df[n],
                metadata={"group": "base", "source": "oosTests.ts"},
            ))

    niv_raw = niv_frame.get("niv_raw")
    if niv_raw is None:
        return pool

    # ── Alternate smoothing windows ──────────────────────────
    for w in [6, 9, 18, 24]:
        col_name = f"niv_smooth_{w}m"
        pool.append(FeatureSpec(
            name=col_name,
            builder=lambda df, win=w: smooth_12m(df["niv_raw"], win),
            metadata={"group": "smoothing", "window": w},
        ))

    # ── Alternate momentum lags ──────────────────────────────
    smoothed = niv_frame.get("smoothed_niv", niv_raw)
    for lag in [1, 6, 12]:
        col_name = f"momentum_{lag}mo"
        pool.append(FeatureSpec(
            name=col_name,
            builder=lambda df, l=lag: df.get("smoothed_niv", df["niv_raw"]).diff(l),
            metadata={"group": "momentum", "lag": lag},
        ))

    # ── Per-component z-scores (rolling 36-month window) ─────
    for comp in ["thrust", "efficiency_squared", "slack", "drag_total"]:
        if comp in niv_frame.columns:
            col_name = f"{comp}_zscore_36m"
            pool.append(FeatureSpec(
                name=col_name,
                builder=lambda df, c=comp: (
                    (df[c] - df[c].rolling(36, min_periods=12).mean())
                    / df[c].rolling(36, min_periods=12).std().clip(lower=1e-8)
                ),
                metadata={"group": "zscore", "component": comp, "window": 36},
            ))

    # ── Cross-component ratios ───────────────────────────────
    if "drag_total" in niv_frame.columns and "thrust" in niv_frame.columns:
        pool.append(FeatureSpec(
            name="drag_thrust_ratio",
            builder=lambda df: df["drag_total"] / df["thrust"].abs().clip(lower=1e-8),
            metadata={"group": "ratio", "meaning": "credit stress — high drag vs thrust"},
        ))

    if "slack" in niv_frame.columns and "efficiency_squared" in niv_frame.columns:
        pool.append(FeatureSpec(
            name="slack_x_efficiency",
            builder=lambda df: df["slack"] * df["efficiency_squared"],
            metadata={"group": "ratio", "meaning": "productive capacity — room to grow AND investing"},
        ))

    if "drag_spread" in niv_frame.columns and "drag_vol" in niv_frame.columns:
        pool.append(FeatureSpec(
            name="spread_vol_interaction",
            builder=lambda df: df["drag_spread"] * df["drag_vol"],
            metadata={"group": "ratio", "meaning": "joint inversion + rate volatility stress"},
        ))

    # ── Regime flags ─────────────────────────────────────────
    if "yield_spread" in niv_frame.columns:
        pool.append(FeatureSpec(
            name="yield_inverted",
            builder=lambda df: (df["yield_spread"] < 0).astype(float),
            metadata={"group": "regime", "meaning": "binary: yield curve inverted"},
        ))

    if "drag_real_rate" in niv_frame.columns:
        pool.append(FeatureSpec(
            name="is_easing",
            builder=lambda df: (df["drag_real_rate"] <= 0).astype(float),
            metadata={"group": "regime", "meaning": "binary: real rate non-positive (accommodative)"},
        ))

    # ── Rolling percentile variants ──────────────────────────
    for w in [60, 120]:
        col_name = f"niv_pctile_rolling_{w}m"
        pool.append(FeatureSpec(
            name=col_name,
            builder=lambda df, win=w: df["niv_raw"].rolling(win, min_periods=24).rank(pct=True),
            metadata={"group": "percentile", "window": w},
        ))

    return pool
