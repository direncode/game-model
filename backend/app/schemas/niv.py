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
    auc_by_horizon: dict[str, float]
    brier_by_horizon: dict[str, float]
    f1_by_horizon: dict[str, float]
    n_folds: int
    n_skipped: int
    warnings: list[str]


class ProtocolDRequest(BaseModel):
    freeze_date: str
    horizons: list[int] = Field(default=[3, 6, 12, 18])


class ProtocolDResponse(BaseModel):
    freeze_date: str
    auc_by_horizon: dict[str, float]
    brier_by_horizon: dict[str, float]
    n_forward_months: int
    n_retrain: int


class OrthogonalVarianceRequest(BaseModel):
    benchmark_series: str = "T10Y3M"
    lags: int = 6


class OrthogonalVarianceResponse(BaseModel):
    fraction: float
    ci_95: list[float]
    betas: dict[str, float]
    benchmark_series: str
    n_obs: int


class TearsheetRequest(BaseModel):
    format: str = "json"
    dataset: str = "us"
    include_protocol_d: bool = False


# ── Bloomberg-grade endpoints ────────────────────────────────────────

class NIVHistoryFullItem(BaseModel):
    date: str
    niv_score: float
    recession_probability: float
    smoothed_niv: float | None = None
    thrust: float
    efficiency_squared: float
    slack: float
    drag_total: float
    drag_spread: float
    drag_real_rate: float
    drag_vol: float
    alert_level: str
    dollar_stakes: float


class NIVHistoryFullResponse(BaseModel):
    data: list[NIVHistoryFullItem]
    count: int
    nber_recessions: list[list[str]]


class EnsembleExplainResponse(BaseModel):
    date: str
    per_learner: dict[str, float]
    combined: float
    lr_coefficients: dict[str, float]
    feature_names: list[str]
    disagreement: float


class WalkForwardSeriesItem(BaseModel):
    date: str
    prob: float
    lower: float
    upper: float
    retrained: bool


class WalkForwardSeriesResponse(BaseModel):
    predictions: list[WalkForwardSeriesItem]
    horizons: list[int]
    auc_by_horizon: dict[str, float]
    brier_by_horizon: dict[str, float]
    f1_by_horizon: dict[str, float]
    n_folds: int
