"""BTUT query endpoints -- multi-dataset survivors, clusters, analysis, magnitude, search."""

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


def _engine(dataset: str = "edgar"):
    return get_query_engine(dataset_id=dataset)


@router.get("/datasets")
async def btut_datasets():
    """List all available datasets with metadata and result availability."""
    try:
        from app.services.btut.adapters import list_datasets
        datasets = list_datasets()
        result = []
        for meta in datasets:
            # Check if result file exists
            engine = get_query_engine(dataset_id=meta.dataset_id)
            has_results = engine.status().get("pipeline_status") == "ready"
            result.append({
                "id": meta.dataset_id,
                "name": meta.display_name,
                "description": meta.description,
                "entity_types": [
                    {"name": t.name, "color": t.color, "primary_field": t.primary_field}
                    for t in meta.entity_types
                ],
                "lookup_field": meta.lookup_field,
                "lookup_label": meta.lookup_label,
                "has_results": has_results,
            })
        return result
    except ImportError:
        return [{"id": "edgar", "name": "SEC EDGAR", "has_results": True}]


@router.get("/status", response_model=BTUTStatusResponse)
async def btut_status(dataset: str = Query(default="edgar")):
    """Pipeline status, last run metrics, total entities processed."""
    return _engine(dataset).status()


@router.get("/summary", response_model=BTUTSummaryResponse)
async def btut_summary(dataset: str = Query(default="edgar")):
    """Full dataset overview with type statistics and 3,000 TB extrapolation."""
    return _engine(dataset).summary()


@router.get("/survivors", response_model=SurvivorListResponse)
async def btut_survivors(
    dataset: str = Query(default="edgar"),
    top_n: int = Query(default=20, ge=1, le=500),
    type: str | None = Query(default=None, description="Filter by entity type"),
    sort_by: str = Query(default="composite"),
):
    """List top survivors ranked by score with anomaly stories."""
    results = _engine(dataset).survivors(top_n=top_n, entity_type=type, sort_by=sort_by)
    return SurvivorListResponse(
        survivors=results,
        total=len(results),
        entity_type_filter=type,
        sort_by=sort_by,
    )


@router.get("/analyze/{ticker}", response_model=CompanyAnalysisResponse)
async def btut_analyze(ticker: str, dataset: str = Query(default="edgar")):
    """Full structural analysis for an entity by lookup key."""
    result = _engine(dataset).analyze(ticker)
    if result is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Ticker '{ticker.upper()}' not found in survivors")
    return result


@router.get("/clusters", response_model=ClusterListResponse)
async def btut_clusters(
    dataset: str = Query(default="edgar"),
    min_size: int = Query(default=1, ge=1),
    top_n: int = Query(default=30, ge=1, le=200),
):
    """List micro-clusters with member counts and type distributions."""
    results = _engine(dataset).clusters(min_size=min_size, top_n=top_n)
    return ClusterListResponse(
        clusters=results,
        total=len(results),
        min_size_filter=min_size,
    )


@router.get("/magnitude/{ticker}", response_model=MagnitudeResponse)
async def btut_magnitude(ticker: str, dataset: str = Query(default="edgar")):
    """Multi-resolution magnitude profile for a specific entity."""
    result = _engine(dataset).magnitude(ticker)
    if result is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Ticker '{ticker.upper()}' not found in survivors")
    return result


@router.get("/search", response_model=SearchResultResponse)
async def btut_search(
    dataset: str = Query(default="edgar"),
    q: str = Query(description="Search keyword"),
    field: str | None = Query(default=None, description="Limit search to specific field"),
):
    """Search across entities by keyword."""
    results = _engine(dataset).search(q, field=field)
    return SearchResultResponse(
        query=q,
        field=field,
        results=results,
        total=len(results),
    )


@router.get("/query")
async def btut_query(
    dataset: str = Query(default="edgar"),
    types: str | None = Query(default=None, description="Comma-separated entity types"),
    min_composite: float | None = Query(default=None, ge=0, le=1),
    max_composite: float | None = Query(default=None, ge=0, le=1),
    min_anomaly: float | None = Query(default=None, ge=0, le=1),
    max_anomaly: float | None = Query(default=None, ge=0, le=1),
    min_flips: int | None = Query(default=None, ge=0, le=48),
    max_flips: int | None = Query(default=None, ge=0, le=48),
    clusters: str | None = Query(default=None, description="Comma-separated cluster IDs"),
    has_ticker: bool | None = Query(default=None),
    sort_by: str = Query(default="composite"),
    sort_order: str = Query(default="desc", description="asc or desc"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Advanced multi-filter query with pagination. The power query endpoint."""
    type_list = [t.strip() for t in types.split(",")] if types else None
    cluster_list = [int(c.strip()) for c in clusters.split(",")] if clusters else None
    return _engine(dataset).query(
        types=type_list, min_composite=min_composite, max_composite=max_composite,
        min_anomaly=min_anomaly, max_anomaly=max_anomaly,
        min_flips=min_flips, max_flips=max_flips,
        clusters=cluster_list, has_ticker=has_ticker,
        sort_by=sort_by, sort_order=sort_order, limit=limit, offset=offset,
    )


@router.get("/compare")
async def btut_compare(
    dataset: str = Query(default="edgar"),
    tickers: str = Query(description="Comma-separated keys to compare"),
):
    """Side-by-side comparison of multiple entities with similarity metrics."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    return _engine(dataset).compare(ticker_list)


@router.get("/distributions")
async def btut_distributions(dataset: str = Query(default="edgar")):
    """Score distributions, histograms, and aggregate analytics."""
    return _engine(dataset).distributions()


@router.get("/anomalies")
async def btut_anomalies(
    dataset: str = Query(default="edgar"),
    top_n: int = Query(default=20, ge=1, le=100),
    type: str | None = Query(default=None),
):
    """Top N most anomalous entities ranked by anomaly score."""
    return _engine(dataset).top_anomalies(n=top_n, entity_type=type)


@router.get("/clusters/{cluster_id}")
async def btut_cluster_detail(cluster_id: int, dataset: str = Query(default="edgar")):
    """Full detail for a specific cluster including all members."""
    result = _engine(dataset).cluster_detail(cluster_id)
    if result is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Cluster {cluster_id} not found")
    return result


@router.post("/ingest")
async def btut_ingest(
    dataset: str = Query(default="edgar"),
    limit: int = Query(default=10000, ge=100, le=200000),
    target_survivors: int = Query(default=500, ge=50, le=5000),
):
    """Trigger async BTUT ingestion via Celery. Returns task ID for tracking."""
    try:
        from app.tasks.btut_ingest import ingest_dataset_task
        task = ingest_dataset_task.delay(
            dataset_id=dataset,
            limit=limit,
            target_survivors=target_survivors,
        )
        return {
            "message": f"BTUT ingestion started for {dataset}",
            "task_id": task.id,
            "dataset": dataset,
            "limit": limit,
            "target_survivors": target_survivors,
        }
    except Exception as e:
        return MessageResponse(
            message=f"Celery not available. Use CLI: python -u scripts/ingest_dataset.py --dataset {dataset} --limit {limit}"
        )
