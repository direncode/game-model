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
    RAGAnalysisResponse,
    BTUTReportStatusResponse,
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


# ── Lineage + Report Endpoints ────────────────────────────────────────

@router.get("/export/convergent")
async def btut_export_all_convergent(
    dataset: str = Query(default="edgar"),
    top_n: int = Query(default=100, ge=1, le=1000),
):
    """Export raw convergent metadata for all survivors as JSON. Full BTUT provenance dump."""
    from app.services.btut.lineage_tracer import LineageTracer

    engine = _engine(dataset)
    tracer = LineageTracer(engine)
    survivors = engine.survivors(top_n=top_n)

    export = []
    for sv in survivors:
        key = sv.get("ticker") or sv.get("name", "")
        analysis = engine.analyze(key)
        lineage = tracer.trace(key)
        export.append({
            "entity_key": key,
            "analysis": analysis,
            "lineage": lineage.to_dict() if lineage else None,
        })

    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"dataset": dataset, "count": len(export), "convergent_metadata": export},
        headers={"Content-Disposition": f"attachment; filename=btut_{dataset}_convergent_export.json"},
    )


@router.get("/convergent/{entity_key}")
async def btut_convergent_metadata(
    entity_key: str,
    dataset: str = Query(default="edgar"),
):
    """Full convergent metadata — BTUT analysis + lineage trace combined."""
    from app.services.btut.lineage_tracer import LineageTracer

    engine = _engine(dataset)
    analysis = engine.analyze(entity_key)
    if not analysis:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Entity '{entity_key}' not found")

    tracer = LineageTracer(engine)
    lineage = tracer.trace(entity_key)

    return {
        "analysis": analysis,
        "lineage": lineage.to_dict() if lineage else None,
    }


@router.get("/lineage/{entity_key}")
async def btut_lineage(
    entity_key: str,
    dataset: str = Query(default="edgar"),
):
    """Trace the structural lineage of a BTUT survivor. No AI — the engine explains itself."""
    from app.services.btut.lineage_tracer import LineageTracer

    engine = _engine(dataset)
    tracer = LineageTracer(engine)
    lineage = tracer.trace(entity_key)

    if lineage is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Entity '{entity_key}' not found")

    return lineage.to_dict()


@router.post("/rag/{entity_key}")
async def btut_rag_analyze(
    entity_key: str,
    dataset: str = Query(default="edgar"),
    force_refresh: bool = Query(default=False),
):
    """Fetch primary sources + Claude synthesis for a BTUT entity."""
    from app.services.btut.rag_engine import RAGEngine
    from app.services.btut.rag_synthesizer import RAGSynthesizer, BTUTContext

    # Get BTUT analysis
    analysis = _engine(dataset).analyze(entity_key)
    if not analysis:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(detail=f"Entity '{entity_key}' not found")

    # Fetch and index sources
    rag = RAGEngine()
    manifest = await rag.fetch_and_index(
        entity_key=entity_key,
        dataset_id=dataset,
        entity_attrs=analysis.get("attributes", {}),
        entity_type=analysis.get("entity_type", ""),
        force_refresh=force_refresh,
    )

    # Search relevant chunks
    chunks = await rag.search_chunks(entity_key, dataset, top_k=15)

    # Build BTUT context
    metadata = analysis.get("metadata", {})
    ctx = BTUTContext(
        entity_key=entity_key,
        entity_name=analysis.get("company_name") or analysis.get("ticker", entity_key),
        entity_type=analysis.get("entity_type", ""),
        dataset_id=dataset,
        scores=analysis.get("scores", {}),
        structural_role=metadata.get("structural_role", {}).get("role", ""),
        role_description=metadata.get("structural_role", {}).get("description", ""),
        fingerprint=analysis.get("lattice_profile", {}).get("fingerprint_48bit", ""),
        flips=analysis.get("lattice_profile", {}).get("total_flips", 0),
        cluster_id=analysis.get("cluster", {}).get("id", -1),
        cluster_size=analysis.get("cluster", {}).get("total_members", 0),
        anomaly_tags=metadata.get("anomaly_taxonomy", []),
        anomaly_story=analysis.get("anomaly_story", ""),
        peer_network=metadata.get("peer_network", []),
        attributes=analysis.get("attributes", {}),
    )

    # Synthesize
    synthesizer = RAGSynthesizer()
    synthesis, was_cached = await synthesizer.synthesize_cached(ctx, chunks)

    return {
        "synthesis": synthesis.to_dict(),
        "source_manifest": {
            "entity_key": manifest.entity_key,
            "dataset_id": manifest.dataset_id,
            "chunk_count": manifest.chunk_count,
            "source_ids": manifest.source_ids,
            "source_types": manifest.source_types,
            "indexed_at": manifest.indexed_at,
            "freshness_hours": manifest.freshness_hours,
        },
        "cached": was_cached,
    }


@router.get("/rag/{entity_key}/sources")
async def btut_rag_sources(
    entity_key: str,
    dataset: str = Query(default="edgar"),
):
    """Check if primary sources exist for an entity."""
    from app.services.btut.rag_engine import RAGEngine
    rag = RAGEngine()
    manifest = await rag.get_source_manifest(entity_key, dataset)
    if manifest is None:
        return {"entity_key": entity_key, "dataset_id": dataset, "chunk_count": 0, "source_ids": []}
    return {
        "entity_key": manifest.entity_key,
        "dataset_id": manifest.dataset_id,
        "chunk_count": manifest.chunk_count,
        "source_ids": manifest.source_ids,
        "source_types": manifest.source_types,
        "indexed_at": manifest.indexed_at,
        "freshness_hours": manifest.freshness_hours,
    }


@router.post("/report")
async def btut_generate_report(request: dict):
    """Dispatch async report generation. Returns task_id for polling."""
    entity_keys = request.get("entity_keys", [])
    dataset = request.get("dataset", "edgar")
    report_format = request.get("format", "pdf")
    report_type = request.get("report_type", "full_analysis")

    if not entity_keys:
        from app.core.exceptions import ValidationError
        raise ValidationError(detail="entity_keys required")

    try:
        from app.tasks.btut_report import generate_btut_report_task
        task = generate_btut_report_task.delay(
            entity_keys=entity_keys,
            dataset_id=dataset,
            report_format=report_format,
            report_type=report_type,
        )
        return {
            "task_id": task.id,
            "status": "started",
            "entity_keys": entity_keys,
            "format": report_format,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/report/{task_id}")
async def btut_report_status(task_id: str):
    """Check report generation status. Returns download info when complete."""
    try:
        from celery.result import AsyncResult
        result = AsyncResult(task_id)
        if result.state == "PENDING":
            return {"task_id": task_id, "status": "pending"}
        elif result.state == "PROGRESS":
            return {"task_id": task_id, "status": "progress", "progress": result.info or {}}
        elif result.state == "SUCCESS":
            return {"task_id": task_id, "status": "completed", **result.result}
        elif result.state == "FAILURE":
            return {"task_id": task_id, "status": "failed", "error": str(result.info)}
        else:
            return {"task_id": task_id, "status": result.state}
    except Exception as e:
        return {"task_id": task_id, "status": "error", "error": str(e)}


@router.post("/ingest")
async def btut_ingest(
    dataset: str = Query(default="edgar"),
    limit: int = Query(default=10000, ge=100, le=200000),
    target_survivors: int = Query(default=500, ge=50, le=5000),
    sync: bool = Query(default=False),
):
    """Trigger BTUT ingestion. Use sync=true to run inline (blocking)."""
    if sync:
        return await _btut_ingest_sync(dataset, limit, target_survivors)

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
            message=f"Celery not available. Use sync=true or CLI: python -u scripts/ingest_dataset.py --dataset {dataset} --limit {limit}"
        )


async def _btut_ingest_sync(dataset_id: str, limit: int, target_survivors: int):
    """Run BTUT ingestion synchronously (blocking). Used when Celery is unavailable."""
    import asyncio
    import json
    import time
    from pathlib import Path

    from app.services.btut.adapters import get_adapter
    from app.services.btut.pipeline import run_btut_pipeline

    adapter = get_adapter(dataset_id)
    meta = adapter.get_meta()

    t0 = time.time()
    entities = await asyncio.get_event_loop().run_in_executor(None, lambda: adapter.fetch_entities(limit=limit))
    edges = await asyncio.get_event_loop().run_in_executor(None, lambda: adapter.fetch_edges(entities))

    unique_types = [t.name for t in meta.entity_types]
    result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: run_btut_pipeline(
            entities=entities, edges=edges,
            unique_types=unique_types, target_survivors=target_survivors,
        ),
    )

    # Save to disk (same paths as Celery task)
    for results_dir in [Path("/app/data"), Path(__file__).resolve().parents[3] / "scripts" / "results"]:
        try:
            results_dir.mkdir(parents=True, exist_ok=True)
            with open(results_dir / f"{dataset_id}_superpower_result.json", "w") as f:
                json.dump(result, f, indent=2)
        except (OSError, PermissionError):
            continue

    # Clear cached query engine
    try:
        from app.services.btut.query_engine import _engines
        _engines.pop(dataset_id, None)
    except Exception:
        pass

    summary = result.get("summary", {})
    return {
        "status": "completed",
        "dataset": dataset_id,
        "entities": summary.get("total_entities", 0),
        "clusters": summary.get("clusters", 0),
        "survivors": summary.get("survivors", 0),
        "wall_seconds": round(time.time() - t0, 1),
    }
