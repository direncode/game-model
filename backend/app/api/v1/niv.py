"""NIV vertical API endpoints — live FRED data integration."""
from __future__ import annotations

import logging
from dataclasses import asdict

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.schemas.niv import (
    NIVLatestResponse,
    NIVHistoryResponse,
    NIVHistoryItem,
    WalkForwardRequest,
    WalkForwardResponse,
    ProtocolDRequest,
    ProtocolDResponse,
    OrthogonalVarianceRequest,
    OrthogonalVarianceResponse,
    TearsheetRequest,
    NIVHistoryFullItem,
    NIVHistoryFullResponse,
    EnsembleExplainResponse,
    WalkForwardSeriesItem,
    WalkForwardSeriesResponse,
)
from app.services.niv.config import NIVConfig
from app.services.niv.vertical import NIVVertical

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/niv", tags=["niv"])

# ── Singleton vertical (lazy init from app settings) ───────────────────
_vertical: NIVVertical | None = None
_cached_frame: pd.DataFrame | None = None
_cached_results: list | None = None
_cached_feature_frame: pd.DataFrame | None = None


def _make_config() -> NIVConfig:
    """Build NIVConfig from app settings."""
    return NIVConfig(
        fred_api_key=settings.FRED_API_KEY or "",
        vintage=settings.NIV_VINTAGE if hasattr(settings, "NIV_VINTAGE") else "latest",
        btut_thinning=settings.NIV_BTUT_THINNING if hasattr(settings, "NIV_BTUT_THINNING") else False,
        crystallization_enabled=settings.NIV_CRYSTALLIZATION if hasattr(settings, "NIV_CRYSTALLIZATION") else False,
    )


def _get_vertical() -> NIVVertical:
    global _vertical
    if _vertical is None:
        _vertical = NIVVertical(_make_config())
    return _vertical


async def _ensure_data() -> tuple[pd.DataFrame, list]:
    """Fetch FRED data and compute NIV scores, caching the result."""
    global _cached_frame, _cached_results
    if _cached_frame is not None and _cached_results is not None:
        return _cached_frame, _cached_results

    v = _get_vertical()
    if not v.config.fred_api_key:
        raise HTTPException(503, "FRED_API_KEY not configured")

    frame = await v.ingest()
    if frame.empty:
        raise HTTPException(502, "FRED ingestion returned empty frame")

    results = v.compute_frame(frame)
    _cached_frame = frame
    _cached_results = results
    return frame, results


async def _ensure_feature_frame() -> pd.DataFrame:
    """Build the feature + label frame for ensemble operations."""
    global _cached_feature_frame
    if _cached_feature_frame is not None:
        return _cached_feature_frame

    from app.services.niv.features import build_base_features, build_recession_labels

    frame, results = await _ensure_data()
    v = _get_vertical()

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
    labels = build_recession_labels(features.index, horizon=12, cfg=v.config)
    features["recession"] = labels.reindex(features.index).fillna(0).astype(int)

    _cached_feature_frame = features
    return features


# ── Read-path endpoints ────────────────────────────────────────────────

@router.get("/latest", response_model=NIVLatestResponse)
async def niv_latest():
    """Current month NIV score, components, alert, and conformal bands."""
    _, results = await _ensure_data()
    r = results[-1]  # most recent month
    return {
        "date": r.date,
        "niv_score": r.niv_score,
        "recession_probability": r.recession_probability,
        "components": {
            "thrust": r.components.thrust,
            "efficiency": r.components.efficiency,
            "efficiency_squared": r.components.efficiency_squared,
            "slack": r.components.slack,
            "drag_total": r.components.drag.total,
            "drag_spread": r.components.drag.spread,
            "drag_real_rate": r.components.drag.real_rate,
            "drag_vol": r.components.drag.vol,
        },
        "alert": {
            "level": r.alert.level,
            "action": r.alert.action,
            "dollar_stakes": r.alert.dollar_stakes,
            "invalidation_prob": r.alert.invalidation_prob,
        },
        "smoothed_niv": r.smoothed_niv,
    }


@router.get("/alert")
async def niv_alert():
    """Current alert envelope."""
    _, results = await _ensure_data()
    r = results[-1]
    return {
        "level": r.alert.level,
        "action": r.alert.action,
        "dollar_stakes": r.alert.dollar_stakes,
        "invalidation_prob": r.alert.invalidation_prob,
        "niv_score": r.niv_score,
        "recession_probability": r.recession_probability,
    }


@router.get("/history", response_model=NIVHistoryResponse)
async def niv_history(
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    smooth: bool = Query(default=True),
):
    """Monthly NIV time series."""
    _, results = await _ensure_data()

    items = []
    for r in results:
        if start and r.date < start:
            continue
        if end and r.date > end:
            continue
        items.append(NIVHistoryItem(
            date=r.date,
            niv_score=r.niv_score,
            recession_probability=r.recession_probability,
            smoothed_niv=r.smoothed_niv,
        ))

    if smooth and items:
        from app.services.niv.formula import smooth_12m
        scores = pd.Series([i.niv_score for i in items])
        smoothed = smooth_12m(scores)
        for i, s in enumerate(smoothed):
            items[i].smoothed_niv = float(s)

    return NIVHistoryResponse(data=items, count=len(items))


@router.get("/datasets")
async def niv_datasets():
    """List available NIV datasets."""
    return [
        {"id": "us", "name": "United States (FRED)", "status": "active"},
        {"id": "uae", "name": "UAE Sovereign Sandbox", "status": "stub"},
    ]


@router.get("/components/{date}")
async def niv_components(date: str):
    """Component breakdown for a single month."""
    _, results = await _ensure_data()
    for r in results:
        if r.date.startswith(date):
            return {
                "date": r.date,
                "niv_score": r.niv_score,
                "recession_probability": r.recession_probability,
                "thrust": r.components.thrust,
                "efficiency": r.components.efficiency,
                "efficiency_squared": r.components.efficiency_squared,
                "slack": r.components.slack,
                "drag_total": r.components.drag.total,
                "drag_spread": r.components.drag.spread,
                "drag_real_rate": r.components.drag.real_rate,
                "drag_vol": r.components.drag.vol,
                "alert": r.alert.level,
            }
    raise HTTPException(404, f"No data for date {date}")


# ── Compute-path endpoints ─────────────────────────────────────────────

@router.post("/walkforward", response_model=WalkForwardResponse)
async def niv_walkforward(req: WalkForwardRequest):
    """Run walk-forward out-of-sample evaluation on live FRED data."""
    features = await _ensure_feature_frame()
    v = _get_vertical()
    v.config.horizons = tuple(req.horizons)
    v.config.combiner = req.combiner

    result = v.fit_walkforward(features)
    return WalkForwardResponse(
        horizons=list(result.horizons),
        auc_by_horizon={str(k): v for k, v in result.auc_by_horizon.items()},
        brier_by_horizon={str(k): v for k, v in result.brier_by_horizon.items()},
        f1_by_horizon={str(k): v for k, v in result.f1_by_horizon.items()},
        n_folds=result.n_folds,
        n_skipped=result.n_skipped,
        warnings=result.warnings,
    )


@router.post("/protocol-d", response_model=ProtocolDResponse)
async def niv_protocol_d(req: ProtocolDRequest):
    """Run Protocol D frozen forward test on live FRED data."""
    features = await _ensure_feature_frame()
    v = _get_vertical()
    result = v.fit_protocol_d(features, req.freeze_date, horizons=tuple(req.horizons))
    return ProtocolDResponse(
        freeze_date=result.freeze_date,
        auc_by_horizon={str(k): v for k, v in result.auc_by_horizon.items()},
        brier_by_horizon={str(k): v for k, v in result.brier_by_horizon.items()},
        n_forward_months=result.n_forward_months,
        n_retrain=result.n_retrain,
    )


@router.post("/orthogonal-variance", response_model=OrthogonalVarianceResponse)
async def niv_orthogonal_variance(req: OrthogonalVarianceRequest):
    """Compute orthogonal variance vs benchmark on live FRED data."""
    frame, results = await _ensure_data()
    niv_series = pd.Series(
        [r.niv_score for r in results],
        index=frame.index[:len(results)],
    )
    benchmark = frame["yield_spread"].iloc[:len(results)]

    from app.services.niv.orthogonal_variance import orthogonal_variance
    result = orthogonal_variance(
        niv_series, benchmark,
        lags=req.lags,
        benchmark_name=req.benchmark_series,
    )
    return OrthogonalVarianceResponse(
        fraction=result.fraction,
        ci_95=list(result.ci_95),
        betas={str(k): v for k, v in result.betas.items()},
        benchmark_series=result.benchmark_series,
        n_obs=result.n_obs,
    )


@router.post("/tearsheet")
async def niv_tearsheet(req: TearsheetRequest):
    """Generate NIV tearsheet from live data."""
    from app.services.niv.tearsheet import generate_tearsheet_json
    _, results = await _ensure_data()
    latest = results[-1] if results else None
    sheet = generate_tearsheet_json(niv_result=latest)
    return sheet


# ── Bloomberg-grade endpoints ──────────────────────────────────────────

@router.get("/history/full", response_model=NIVHistoryFullResponse)
async def niv_history_full():
    """Full history with per-month component breakdown + NBER dates."""
    _, results = await _ensure_data()
    v = _get_vertical()
    items = []
    for r in results:
        items.append(NIVHistoryFullItem(
            date=r.date,
            niv_score=r.niv_score,
            recession_probability=r.recession_probability,
            smoothed_niv=r.smoothed_niv,
            thrust=r.components.thrust,
            efficiency_squared=r.components.efficiency_squared,
            slack=r.components.slack,
            drag_total=r.components.drag.total,
            drag_spread=r.components.drag.spread,
            drag_real_rate=r.components.drag.real_rate,
            drag_vol=r.components.drag.vol,
            alert_level=r.alert.level,
            dollar_stakes=r.alert.dollar_stakes,
        ))
    nber = [[s, e] for s, e in v.config.nber_recessions]
    return NIVHistoryFullResponse(data=items, count=len(items), nber_recessions=nber)


@router.get("/ensemble/explain", response_model=EnsembleExplainResponse)
async def niv_ensemble_explain():
    """Per-learner predictions + LR coefficients for current month."""
    import numpy as np
    from app.services.niv.features import FEATURE_NAMES
    from app.services.niv.ensemble import NIVEnsemble

    features = await _ensure_feature_frame()
    v = _get_vertical()

    feature_cols = [c for c in features.columns if c != "recession"]
    X = features[feature_cols].values
    y = features["recession"].values

    ensemble = NIVEnsemble(cfg=v.config)
    ensemble.fit(X, y)
    explanation = ensemble.explain(X[-1:])

    per_learner = {k: float(v[0]) for k, v in explanation.per_learner.items()}
    combined = float(explanation.combined[0])
    disagreement = max(per_learner.values()) - min(per_learner.values())

    lr_coefs = {}
    if explanation.lr_coefficients is not None:
        for i, name in enumerate(FEATURE_NAMES[:len(explanation.lr_coefficients)]):
            lr_coefs[name] = float(explanation.lr_coefficients[i])

    return EnsembleExplainResponse(
        date=str(features.index[-1]),
        per_learner=per_learner,
        combined=combined,
        lr_coefficients=lr_coefs,
        feature_names=list(FEATURE_NAMES),
        disagreement=disagreement,
    )


@router.get("/walkforward/series", response_model=WalkForwardSeriesResponse)
async def niv_walkforward_series():
    """Walk-forward per-step prediction time series with conformal bands."""
    features = await _ensure_feature_frame()
    v = _get_vertical()
    result = v.fit_walkforward(features)
    return WalkForwardSeriesResponse(
        predictions=[WalkForwardSeriesItem(**p) for p in result.predictions],
        horizons=list(result.horizons),
        auc_by_horizon={str(k): v for k, v in result.auc_by_horizon.items()},
        brier_by_horizon={str(k): v for k, v in result.brier_by_horizon.items()},
        f1_by_horizon={str(k): v for k, v in result.f1_by_horizon.items()},
        n_folds=result.n_folds,
    )


@router.post("/crystallize")
async def niv_crystallize():
    """Submit walk-forward result to TCD-JEPA."""
    return {"status": "stub", "module_ids": []}


@router.get("/health")
async def niv_health():
    cfg = _make_config()
    return {
        "status": "ok",
        "vertical": "niv",
        "fred_api_key_set": bool(cfg.fred_api_key),
        "vintage": cfg.vintage,
    }


@router.post("/cache/clear")
async def niv_clear_cache():
    """Clear cached FRED data to force re-fetch."""
    global _cached_frame, _cached_results, _cached_feature_frame
    _cached_frame = None
    _cached_results = None
    _cached_feature_frame = None
    return {"status": "cleared"}
