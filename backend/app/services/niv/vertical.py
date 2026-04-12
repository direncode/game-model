"""NIVVertical — single entrypoint the platform wires everything through."""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from .config import NIVConfig
from .formula import compute_single as _compute_single, NIVResult

logger = logging.getLogger(__name__)


class NIVVertical:
    """Facade for the NIV vertical."""

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
        return _compute_single(cfg=self.config, **kwargs)

    async def ingest(self, start: str | None = None, end: str | None = None) -> pd.DataFrame:
        from .fred_adapter import ingest
        return await ingest(self.config, start, end)

    def compute_frame(self, frame: pd.DataFrame) -> list[NIVResult]:
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
        from .ensemble import NIVEnsemble
        from .walkforward import WalkForwardConfig, walkforward
        config = WalkForwardConfig(
            warmup_frac=self.config.warmup_frac,
            retrain_every=self.config.retrain_every,
            horizons=self.config.horizons,
        )
        return walkforward(frame, lambda: NIVEnsemble(cfg=self.config), config, **kwargs)

    def fit_protocol_d(self, frame: pd.DataFrame, freeze_date: str, **kwargs):
        from .ensemble import NIVEnsemble
        from .protocol_d import protocol_d
        return protocol_d(frame, freeze_date, NIVEnsemble(cfg=self.config), **kwargs)

    def orthogonal_variance(self, niv_series: pd.Series, benchmark: pd.Series, **kwargs):
        from .orthogonal_variance import orthogonal_variance
        return orthogonal_variance(niv_series, benchmark, **kwargs)

    def tearsheet(self, niv_result=None, walkforward_result=None, **kwargs) -> Path:
        from .tearsheet import generate_tearsheet_json, save_tearsheet
        sheet = generate_tearsheet_json(niv_result, walkforward_result)
        output = Path("output/niv_tearsheet")
        return save_tearsheet(sheet, output, fmt=kwargs.get("fmt", "json"))
