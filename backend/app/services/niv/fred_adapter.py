"""FRED/ALFRED data fetcher and preprocessor.

Fetches the 7 macro series, aligns via 90-day nearest-neighbor (matching fred.rs),
and computes the derived fields needed by formula.py.
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


async def fetch_series(
    series_id: str,
    api_key: str,
    start: str | None = None,
    end: str | None = None,
    realtime: bool = False,
) -> pd.Series:
    """Fetch a single FRED (or ALFRED real-time vintage) series."""
    params: dict = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
    }
    if start:
        params["observation_start"] = start
    if end:
        params["observation_end"] = end
    if realtime:
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
    """Align multiple series to a common monthly grid via nearest-neighbor."""
    if not series_dict:
        return pd.DataFrame()

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
    """Full ingestion: fetch all 7 series, align, compute derived."""
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
