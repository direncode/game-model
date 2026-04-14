"""REST endpoints for LatentOceanDataLayer — the unified ingest+reduction spine.

Stateless: every request builds a fresh ``LatentOceanDataLayer``
instance. For the typical 300-survivor case a full ingest+BTUT+manifold
round-trip is a few seconds; large ingests (EDGAR full pull) may take
minutes. If you need async jobs later, wrap these in Celery tasks and
return a job id.

Endpoints
---------
GET  /data-layer/sources
    List registered dataset adapters (id, display name, description).

POST /data-layer/run
    One-shot: ingest -> BTUT -> manifold -> optional vertical export.
    Returns quality metrics + optional payload.

POST /data-layer/link
    Cross-source causal linking. Runs the full pipeline on TWO sources
    and returns all four-signal links between them.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.btut.adapters import list_datasets
from app.services.data_layer import LatentOceanDataLayer
from app.services.data_layer.errors import (
    DataLayerError,
    UnknownSourceError,
    UnknownVerticalError,
)

router = APIRouter(prefix="/data-layer", tags=["data-layer"])


# ── Request / response schemas ──────────────────────────────────────────
class SourceInfo(BaseModel):
    id: str
    name: str
    description: str
    lookup_field: str
    lookup_label: str


class RunRequest(BaseModel):
    source: str = Field(..., description="Dataset id, e.g. 'edgar', 'pubmed'")
    limit: int = Field(500, ge=1, le=100_000)
    target_survivors: int = Field(100, ge=1, le=10_000)
    budget_dollars: float = Field(5.0, ge=0.0)
    compute_3d_display: bool = True
    vertical: Literal["tcd_jepa", "data"] | None = None


class QualityMetricsOut(BaseModel):
    n_input: int
    n_survivors: int
    reduction_ratio: int
    variance_ratio: float
    coverage_at_1_0: float
    reconstruction_median_nn: float
    n_clusters: int
    unique_fingerprints: int
    wall_seconds: float
    estimated_cost_usd: float
    cost_breakdown: dict


class RunResponse(BaseModel):
    dataset_id: str
    quality: QualityMetricsOut
    vertical: str | None = None
    payload: dict | None = Field(
        default=None,
        description="Vertical export payload, only present when `vertical` is requested.",
    )


class LinkRequest(BaseModel):
    source_a: str
    source_b: str
    limit: int = Field(500, ge=1, le=100_000)
    target_survivors: int = Field(100, ge=1, le=10_000)
    budget_dollars: float = Field(5.0, ge=0.0)
    cosine_threshold: float = Field(0.75, ge=0.0, le=1.0)


class CausalLinkOut(BaseModel):
    source_a: str
    source_b: str
    signal: str
    strength: float


class LinkResponse(BaseModel):
    dataset_a: str
    dataset_b: str
    quality_a: QualityMetricsOut
    quality_b: QualityMetricsOut
    n_links: int
    links_by_signal: dict[str, int]
    links: list[CausalLinkOut] = Field(
        ...,
        description="Up to `max_links_returned` strongest links (truncated for payload size).",
    )
    max_links_returned: int = 500


# ── Endpoints ───────────────────────────────────────────────────────────
@router.get("/sources", response_model=list[SourceInfo])
async def data_layer_sources() -> list[SourceInfo]:
    """List registered dataset adapters available to the data layer."""
    return [
        SourceInfo(
            id=m.dataset_id,
            name=m.display_name,
            description=m.description,
            lookup_field=m.lookup_field,
            lookup_label=m.lookup_label,
        )
        for m in list_datasets()
    ]


def _quality_from(layer: LatentOceanDataLayer) -> QualityMetricsOut:
    q = layer.get_quality_metrics()
    return QualityMetricsOut(
        n_input=q.n_input,
        n_survivors=q.n_survivors,
        reduction_ratio=q.reduction_ratio,
        variance_ratio=q.variance_ratio,
        coverage_at_1_0=q.coverage_at_1_0,
        reconstruction_median_nn=q.reconstruction_median_nn,
        n_clusters=q.n_clusters,
        unique_fingerprints=q.unique_fingerprints,
        wall_seconds=q.wall_seconds,
        estimated_cost_usd=q.estimated_cost_usd,
        cost_breakdown=q.cost_breakdown,
    )


@router.post("/run", response_model=RunResponse)
async def data_layer_run(req: RunRequest) -> RunResponse:
    """Run the full data layer pipeline on a single source.

    Synchronous. For large ingests (limit > 5000) expect tens of seconds
    of latency; clients should set generous timeouts.
    """
    layer = LatentOceanDataLayer(
        budget_dollars=req.budget_dollars,
        target_survivors=req.target_survivors,
        compute_3d_display=req.compute_3d_display,
    )
    try:
        layer.ingest(req.source, limit=req.limit)
        layer.apply_btut_tuner()
        layer.project_to_manifold()
    except UnknownSourceError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DataLayerError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    payload: dict | None = None
    if req.vertical is not None:
        try:
            payload = layer.export_for_vertical(req.vertical)
        except UnknownVerticalError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    assert layer.ingest_result is not None  # set by layer.ingest()
    return RunResponse(
        dataset_id=layer.ingest_result.source_id,
        quality=_quality_from(layer),
        vertical=req.vertical,
        payload=payload,
    )


@router.post("/link", response_model=LinkResponse)
async def data_layer_link(req: LinkRequest) -> LinkResponse:
    """Cross-source causal linking. Runs the pipeline on two sources
    and returns all four-signal links between their survivors.

    The response truncates to the top ``max_links_returned`` strongest
    links to keep payloads bounded; the full ``n_links`` and
    per-signal breakdown are always present.
    """
    layer_a = LatentOceanDataLayer(
        budget_dollars=req.budget_dollars,
        target_survivors=req.target_survivors,
        compute_3d_display=False,  # linking never uses 3D coords
    )
    layer_b = LatentOceanDataLayer(
        budget_dollars=req.budget_dollars,
        target_survivors=req.target_survivors,
        compute_3d_display=False,
    )
    try:
        layer_a.ingest(req.source_a, limit=req.limit)
        layer_a.apply_btut_tuner()
        layer_a.project_to_manifold()
        layer_b.ingest(req.source_b, limit=req.limit)
        layer_b.apply_btut_tuner()
        layer_b.project_to_manifold()
    except UnknownSourceError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DataLayerError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    links = layer_a.link_causally(layer_b, threshold=req.cosine_threshold)
    by_signal: dict[str, int] = {}
    for lk in links:
        by_signal[lk.signal] = by_signal.get(lk.signal, 0) + 1

    MAX = 500
    top = sorted(links, key=lambda x: -x.strength)[:MAX]
    assert layer_a.ingest_result is not None and layer_b.ingest_result is not None
    return LinkResponse(
        dataset_a=layer_a.ingest_result.source_id,
        dataset_b=layer_b.ingest_result.source_id,
        quality_a=_quality_from(layer_a),
        quality_b=_quality_from(layer_b),
        n_links=len(links),
        links_by_signal=by_signal,
        links=[
            CausalLinkOut(
                source_a=lk.source_a,
                source_b=lk.source_b,
                signal=lk.signal,
                strength=lk.strength,
            )
            for lk in top
        ],
        max_links_returned=MAX,
    )


# ── Async (Celery) endpoints ────────────────────────────────────────────
class AsyncRunRequest(BaseModel):
    source: str
    limit: int = Field(500, ge=1, le=1_000_000)
    target_survivors: int = Field(300, ge=1, le=50_000)
    budget_dollars: float = Field(50.0, ge=0.0)
    vertical: Literal["tcd_jepa", "data"] | None = None
    chunk_size: int | None = Field(
        default=None,
        ge=100,
        description="If set, triggers two-pass chunked cascade.",
    )


class AsyncLinkRequest(BaseModel):
    source_a: str
    source_b: str
    limit: int = Field(500, ge=1, le=1_000_000)
    target_survivors: int = Field(300, ge=1, le=50_000)
    budget_dollars: float = Field(50.0, ge=0.0)
    cosine_threshold: float = Field(0.75, ge=0.0, le=1.0)


class JobSubmitResponse(BaseModel):
    job_id: str
    status: str = "submitted"


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: dict | None = None
    result: dict | None = None


@router.post("/run-async", response_model=JobSubmitResponse)
async def data_layer_run_async(req: AsyncRunRequest) -> JobSubmitResponse:
    """Submit an async data layer pipeline run. Returns immediately with a job_id."""
    from app.tasks.data_layer_run import data_layer_run_task

    task = data_layer_run_task.delay(
        source=req.source,
        limit=req.limit,
        target_survivors=req.target_survivors,
        budget_dollars=req.budget_dollars,
        vertical=req.vertical,
        chunk_size=req.chunk_size,
    )
    return JobSubmitResponse(job_id=task.id)


@router.post("/link-async", response_model=JobSubmitResponse)
async def data_layer_link_async(req: AsyncLinkRequest) -> JobSubmitResponse:
    """Submit an async cross-source causal linking job."""
    from app.tasks.data_layer_run import data_layer_link_task

    task = data_layer_link_task.delay(
        source_a=req.source_a,
        source_b=req.source_b,
        limit=req.limit,
        target_survivors=req.target_survivors,
        budget_dollars=req.budget_dollars,
        cosine_threshold=req.cosine_threshold,
    )
    return JobSubmitResponse(job_id=task.id)


@router.get("/job/{job_id}", response_model=JobStatusResponse)
async def data_layer_job_status(job_id: str) -> JobStatusResponse:
    """Poll the status of an async data layer job."""
    from celery.result import AsyncResult

    from app.celery_app import celery_app as app

    ar = AsyncResult(job_id, app=app)
    state = ar.state

    progress = None
    result = None

    if state == "PROGRESS":
        progress = ar.info if isinstance(ar.info, dict) else {"message": str(ar.info)}
    elif state == "SUCCESS":
        result = ar.result if isinstance(ar.result, dict) else {"value": ar.result}
    elif state == "FAILURE":
        result = {"error": str(ar.result)}

    return JobStatusResponse(
        job_id=job_id,
        status=state,
        progress=progress,
        result=result,
    )


# ── Ocean Orchestrator endpoints ───────────────────────────────────────
class OceanBuildRequest(BaseModel):
    sources: list[str] | None = None
    limits: dict[str, int] | None = None
    default_limit: int = Field(500, ge=1, le=100_000)
    target_survivors: int = Field(100, ge=1, le=10_000)
    budget_dollars: float = Field(5.0, ge=0.0)
    cosine_threshold: float = Field(0.75, ge=0.0, le=1.0)


class OceanSourceSummary(BaseModel):
    source_id: str
    n_input: int
    n_survivors: int
    reduction_ratio: int
    coverage_at_1_0: float
    variance_ratio: float
    wall_seconds: float
    cost_usd: float


class OceanCrossLink(BaseModel):
    source_a: str
    source_b: str
    n_links: int
    links_by_signal: dict[str, int]


class OceanSurvivorOut(BaseModel):
    name: str
    type: str
    source_id: str
    display_name: str
    cluster: int
    composite_score: float
    coord_3d: list[float] | None


class OceanManifestResponse(BaseModel):
    sources: list[OceanSourceSummary]
    n_total_survivors: int
    survivors: list[OceanSurvivorOut]
    cross_links: list[OceanCrossLink]
    link_matrix: dict[str, dict[str, int]]
    total_cost_usd: float
    total_wall_seconds: float
    benchmark: list[dict]


def _manifest_to_response(manifest) -> OceanManifestResponse:
    """Convert an OceanManifest dataclass to the Pydantic response model.

    OceanManifest.sources is dict[str, SourceResult] where quality
    metrics live on SourceResult.quality. OceanManifest.unified_survivors
    is list[dict] with plain dict entries. OceanManifest.cross_links
    is list[CrossLinkResult] with .pair tuple.
    """
    # Sources: dict values → flat list
    sources = []
    for src_id, sr in manifest.sources.items():
        q = sr.quality
        sources.append(
            OceanSourceSummary(
                source_id=src_id,
                n_input=q.n_input,
                n_survivors=q.n_survivors,
                reduction_ratio=q.reduction_ratio,
                coverage_at_1_0=float(q.coverage_at_1_0),
                variance_ratio=float(q.variance_ratio),
                wall_seconds=float(sr.wall_seconds),
                cost_usd=float(q.estimated_cost_usd),
            )
        )

    # Survivors: list[dict] → list[OceanSurvivorOut]
    survivors = [
        OceanSurvivorOut(
            name=str(sv.get("name", "")),
            type=str(sv.get("type", "")),
            source_id=str(sv.get("source_id", "")),
            display_name=str(sv.get("display_name", sv.get("name", ""))),
            cluster=int(sv.get("cluster", 0)),
            composite_score=float(sv.get("composite_score", 0)),
            coord_3d=[float(c) for c in sv["coord_3d"]] if sv.get("coord_3d") else None,
        )
        for sv in manifest.unified_survivors
    ]

    # Cross-links: CrossLinkResult has .pair tuple
    cross_links = [
        OceanCrossLink(
            source_a=cl.pair[0],
            source_b=cl.pair[1],
            n_links=cl.n_links,
            links_by_signal={k: int(v) for k, v in cl.links_by_signal.items()},
        )
        for cl in manifest.cross_links
    ]

    link_matrix = {
        k: {kk: int(vv) for kk, vv in v.items()}
        for k, v in manifest.link_matrix.items()
    }
    benchmark = [
        {bk: (float(bv) if isinstance(bv, (int, float)) else str(bv)) for bk, bv in entry.items()}
        for entry in manifest.benchmark
    ]
    return OceanManifestResponse(
        sources=sources,
        n_total_survivors=len(survivors),
        survivors=survivors,
        cross_links=cross_links,
        link_matrix=link_matrix,
        total_cost_usd=float(manifest.total_cost_usd),
        total_wall_seconds=float(manifest.total_wall_seconds),
        benchmark=benchmark,
    )


@router.post("/ocean/build", response_model=OceanManifestResponse)
async def ocean_build(req: OceanBuildRequest) -> OceanManifestResponse:
    """Synchronous multi-source ocean build.

    Runs OceanOrchestrator.build_ocean() and returns the full manifest.
    For large builds consider the async variant.
    """
    from app.services.data_layer.orchestrator import OceanOrchestrator

    orch = OceanOrchestrator(
        target_survivors=req.target_survivors,
        budget_dollars=req.budget_dollars,
        cosine_threshold=req.cosine_threshold,
    )
    try:
        manifest = orch.build_ocean(
            sources=req.sources,
            limits=req.limits,
            default_limit=req.default_limit,
        )
    except UnknownSourceError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DataLayerError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return _manifest_to_response(manifest)


@router.post("/ocean/build-async", response_model=JobSubmitResponse)
async def ocean_build_async(req: OceanBuildRequest) -> JobSubmitResponse:
    """Submit an async ocean build job. Returns immediately with a job_id."""
    from app.tasks.ocean_build import ocean_build_task

    task = ocean_build_task.delay(
        sources=req.sources,
        limits=req.limits,
        default_limit=req.default_limit,
        target_survivors=req.target_survivors,
        budget_dollars=req.budget_dollars,
        cosine_threshold=req.cosine_threshold,
    )
    return JobSubmitResponse(job_id=task.id)
