"""BTUT query endpoints -- survivors, clusters, analysis, magnitude, search."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.btut import (
    BTUTStatusResponse,
    BTUTSummaryResponse,
    ClusterListResponse,
    CompanyAnalysisResponse,
    MagnitudeResponse,
    SearchResultResponse,
    SurvivorListResponse,
)
from app.schemas.common import MessageResponse
from app.services.btut.query_engine import get_query_engine

router = APIRouter(prefix="/btut", tags=["btut"])


def _engine():
    return get_query_engine()


@router.get("/status", response_model=BTUTStatusResponse)
async def btut_status():
    """Pipeline status, last run metrics, total entities processed."""
    return _engine().status()


@router.get("/summary", response_model=BTUTSummaryResponse)
async def btut_summary():
    """Full dataset overview with type statistics and 3,000 TB extrapolation."""
    return _engine().summary()


@router.get("/survivors", response_model=SurvivorListResponse)
async def btut_survivors(
    top_n: int = Query(default=20, ge=1, le=500),
    type: str | None = Query(default=None, description="Filter by entity type: company, filing, financial_fact"),
    sort_by: str = Query(default="composite", description="Sort field: composite, anomaly, diversity, reconstruction"),
):
    """List top survivors ranked by score with anomaly stories."""
    results = _engine().survivors(top_n=top_n, entity_type=type, sort_by=sort_by)
    return SurvivorListResponse(
        survivors=results,
        total=len(results),
        entity_type_filter=type,
        sort_by=sort_by,
    )


@router.get("/analyze/{ticker}", response_model=CompanyAnalysisResponse)
async def btut_analyze(ticker: str):
    """Full structural analysis for a company by ticker symbol."""
    result = _engine().analyze(ticker)
    if result is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Ticker '{ticker.upper()}' not found in survivors")
    return result


@router.get("/clusters", response_model=ClusterListResponse)
async def btut_clusters(
    min_size: int = Query(default=1, ge=1),
    top_n: int = Query(default=30, ge=1, le=200),
):
    """List micro-clusters with member counts and type distributions."""
    results = _engine().clusters(min_size=min_size, top_n=top_n)
    return ClusterListResponse(
        clusters=results,
        total=len(results),
        min_size_filter=min_size,
    )


@router.get("/magnitude/{ticker}", response_model=MagnitudeResponse)
async def btut_magnitude(ticker: str):
    """Multi-resolution magnitude profile for a specific entity."""
    result = _engine().magnitude(ticker)
    if result is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Ticker '{ticker.upper()}' not found in survivors")
    return result


@router.get("/search", response_model=SearchResultResponse)
async def btut_search(
    q: str = Query(description="Search keyword"),
    field: str | None = Query(default=None, description="Limit search to specific field"),
):
    """Search across entities by keyword."""
    results = _engine().search(q, field=field)
    return SearchResultResponse(
        query=q,
        field=field,
        results=results,
        total=len(results),
    )


@router.post("/ingest", response_model=MessageResponse)
async def btut_ingest():
    """Trigger a new EDGAR ingestion + BTUT superpower pipeline."""
    # Future: Celery task. For now, return status.
    return MessageResponse(
        message="Ingestion pipeline available via CLI: python -u scripts/edgar_superpower.py"
    )
