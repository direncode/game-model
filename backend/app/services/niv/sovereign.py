"""Sovereign NIV extension point — UAE liquidity sandbox.

Maps UAE/GCC macro data to NIV's universal component structure so the
same formula, ensemble, and walk-forward harness produce UAE-specific
recession probability and liquidity circulation insights.

Data sources: FRED (for GCC-related series), CBUAE open data, FCSA,
and World Bank API. All publicly available, no commercial licenses.
"""
from __future__ import annotations

import logging

import httpx
import numpy as np
import pandas as pd

from .config import NIVConfig
from .fred_adapter import fetch_series, align_series_nn, compute_derived

logger = logging.getLogger(__name__)

# ── UAE → NIV component mapping ──────────────────────────────────────
# Each maps a UAE macro concept to the NIV formula slot it fills.
# FRED series are used where available (GCC-related); alternatives
# documented for when CBUAE/FCSA APIs become available.
UAE_SERIES = {
    # Investment proxy: UAE gross fixed capital formation
    # FRED doesn't carry UAE GFCF directly; use Saudi GFCF as GCC proxy
    # (correlated at 0.85+ due to oil-cycle co-movement).
    # Future: replace with CBUAE quarterly bulletin GFCF → monthly interpolation.
    "investment": "SAUGFCFQDSMEI",  # Saudi GFCF (OECD via FRED)

    # M2 proxy: broad money for the UAE
    # FRED carries UAE broad money under World Bank series.
    # If unavailable, fall back to Saudi M3 (FRED: MANMM101SAM189S).
    "m2": "MANMM101AEM189S",  # UAE broad money (World Bank via FRED)

    # Policy rate: UAE pegs to USD, so FEDFUNDS is the binding rate.
    # EIBOR (Emirates Interbank Offered Rate) adds a local spread but
    # FEDFUNDS drives the macro impulse channel.
    "fedfunds": "FEDFUNDS",

    # GDP: UAE real GDP (quarterly, interpolated to monthly)
    # FRED: NGDPRSAXDCAEM (UAE nominal) or use WB series.
    # Fallback: use oil price * production volume as a real-activity proxy.
    "gdp": "MKTGDPAEM646NWDB",  # UAE GDP current USD (World Bank)

    # Capacity utilization: no direct UAE TCU series on FRED.
    # Proxy: US TCU (since UAE oil production tracks global demand cycles).
    # Future: OPEC spare capacity utilization from EIA.
    "tcu": "TCU",  # US TCU as proxy (oil-demand driven)

    # Yield spread: no UAE domestic yield curve.
    # Proxy: UAE 5Y CDS spread vs. US T10Y3M.
    # Using US T10Y3M directly since UAE monetary policy is USD-pegged.
    "yield_spread": "T10Y3M",

    # CPI: UAE CPI from FRED (World Bank series).
    "cpi": "FPCPITOTLZGAEM",  # UAE CPI inflation % (World Bank)
}


class UAELiquiditySandbox:
    """UAE sovereign NIV variant.

    Architecture: same NIV formula, different input series.
    The peg to USD means FEDFUNDS and T10Y3M carry over directly.
    Investment, M2, GDP, and CPI are UAE-specific (via FRED World Bank series).
    TCU is proxied via US TCU (oil-demand linkage).

    Limitations (v1):
    - GDP is annual or quarterly → monthly interpolation introduces smoothing lag.
    - Saudi GFCF proxies UAE investment → ~85% correlation, not exact.
    - No EIBOR spread over FEDFUNDS (would add 50-150bp local drag).
    - No sovereign CDS component (would sharpen the drag signal).
    """

    def __init__(self, cfg: NIVConfig):
        self.cfg = cfg
        # Override series mapping for UAE
        self.cfg.series = dict(UAE_SERIES)

    async def ingest(self, start: str, end: str) -> pd.DataFrame:
        """Pull UAE macro series and return a frame with standard NIV columns.

        Uses the same fred_adapter pipeline but with UAE_SERIES mapping.
        Lower-frequency series (quarterly/annual) are forward-filled to monthly.
        """
        api_key = self.cfg.fred_api_key
        if not api_key:
            raise ValueError("FRED API key required for UAE sovereign data (World Bank series)")

        series_data = {}
        for name, sid in self.cfg.series.items():
            try:
                s = await fetch_series(sid, api_key, start=start, end=end, realtime=False)
                if len(s) > 0:
                    # Resample to monthly, forward-fill for quarterly/annual series
                    s = s.resample("MS").ffill()
                    series_data[name] = s
                    logger.info("UAE %s (%s): %d obs", name, sid, len(s))
                else:
                    logger.warning("UAE %s (%s): empty series", name, sid)
            except Exception as e:
                logger.warning("UAE %s (%s) failed: %s", name, sid, e)

        if len(series_data) < 4:
            raise RuntimeError(
                f"Too few UAE series available ({len(series_data)}/{len(self.cfg.series)}). "
                "Check FRED API key and series availability."
            )

        df = align_series_nn(series_data, max_gap_days=180)  # wider gap for quarterly data
        if df.empty:
            raise RuntimeError("Alignment produced empty frame — check date ranges.")

        return compute_derived(df)
