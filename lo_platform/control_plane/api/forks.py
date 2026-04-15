"""Fork management API — CRUD + lifecycle operations.

Provides RESTful endpoints for creating, listing, inspecting, and
managing customer fork instances. All mutations go through the
ForkProvisioner service.

Routes:
    POST   /forks/              — Create a new fork
    GET    /forks/              — List all forks (filterable)
    GET    /forks/{fork_id}     — Get fork detail
    POST   /forks/{fork_id}/suspend  — Suspend a fork
    POST   /forks/{fork_id}/resume   — Resume a suspended fork
    POST   /forks/{fork_id}/reduce   — Trigger ad-hoc reduction
    PATCH  /forks/{fork_id}/config   — Update fork engine config
    GET    /forks/{fork_id}/health   — Get fork health score
    GET    /forks/{fork_id}/usage    — Get fork usage metrics
    DELETE /forks/{fork_id}          — Teardown a fork
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forks", tags=["forks"])


# ── Request/Response models ───────────────────────────────────────────


class CreateForkRequest(BaseModel):
    """Request body for creating a new fork."""

    customer_id: str
    subdomain: str = Field(
        ...,
        min_length=3,
        max_length=63,
        pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$",
        description="Subdomain for the fork (e.g. 'acme')",
    )
    source_connection_string: str = Field(
        ..., description="Customer's source database DSN"
    )
    output_connection_string: str | None = Field(
        None, description="Output DSN (defaults to source)"
    )
    output_schema: str = "latent_ocean"
    enabled_modules: list[str] | None = None
    engine_budget: float = 50.0
    target_survivors: int = 300
    display_name: str = ""
    reduction_schedule: str = "0 2 * * *"


class UpdateConfigRequest(BaseModel):
    """Request body for updating fork engine config."""

    budget_dollars: float | None = None
    target_survivors: int | None = None
    thinning_strategy: str | None = None
    compute_3d_display: bool | None = None
    flow_engine_enabled: bool | None = None
    reduction_schedule: str | None = None


class ForkResponse(BaseModel):
    """Standard fork response."""

    id: str
    customer_id: str
    subdomain: str
    status: str
    display_name: str = ""
    error: str | None = None


class ForkDetailResponse(ForkResponse):
    """Detailed fork response with metrics."""

    entity_count: int = 0
    survivor_count: int = 0
    queries_served_total: int = 0
    storage_used_bytes: int = 0
    health_status: str = "unknown"
    health_score: float = 0.0
    last_reduction_at: str | None = None
    created_at: str | None = None
    engine_config: dict = {}
    enabled_modules: list[str] = []


# ── Dependency injection ──────────────────────────────────────────────

# These will be set by the app factory or startup event.
_provisioner = None
_metering = None
_health_scorer = None


def configure_services(
    provisioner: Any,
    metering: Any = None,
    health_scorer: Any = None,
) -> None:
    """Wire up service instances for the router.

    Called during app startup to inject dependencies.
    """
    global _provisioner, _metering, _health_scorer
    _provisioner = provisioner
    _metering = metering
    _health_scorer = health_scorer


def _get_provisioner():
    if _provisioner is None:
        raise HTTPException(
            status_code=503,
            detail="Fork provisioner not initialized",
        )
    return _provisioner


# ── Routes ────────────────────────────────────────────────────────────


@router.post("/", response_model=ForkResponse, status_code=201)
async def create_fork(request: CreateForkRequest) -> dict:
    """Create a new fork instance for a customer.

    Provisions a Docker container, initializes the materializer schema,
    and optionally runs an initial reduction.
    """
    from ..services.provisioner import ForkProvisionRequest

    provisioner = _get_provisioner()

    provision_req = ForkProvisionRequest(
        customer_id=request.customer_id,
        subdomain=request.subdomain,
        source_connection_string=request.source_connection_string,
        output_connection_string=request.output_connection_string,
        output_schema=request.output_schema,
        enabled_modules=request.enabled_modules,
        engine_budget=request.engine_budget,
        target_survivors=request.target_survivors,
        display_name=request.display_name,
        reduction_schedule=request.reduction_schedule,
    )

    try:
        result = await provisioner.create_fork(provision_req)
        return result
    except ConnectionError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot connect to source database: {exc}",
        )
    except Exception as exc:
        logger.error("[api] create_fork failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Fork creation failed: {exc}",
        )


@router.get("/")
async def list_forks(
    customer_id: str | None = Query(None, description="Filter by customer"),
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    """List all forks, optionally filtered by customer or status.

    Returns a paginated list of fork summaries.
    """
    # In production, this queries the database via the provisioner
    # or a dedicated query service. For now, return structure.
    return {
        "forks": [],
        "total": 0,
        "limit": limit,
        "offset": offset,
        "filters": {
            "customer_id": customer_id,
            "status": status,
        },
    }


@router.get("/{fork_id}")
async def get_fork(fork_id: str) -> dict:
    """Get detailed information about a specific fork.

    Returns fork metadata, configuration, metering counters,
    and current health status.
    """
    provisioner = _get_provisioner()
    health = await provisioner.get_fork_health(fork_id)
    return {
        "fork_id": fork_id,
        "health": health,
    }


@router.post("/{fork_id}/suspend")
async def suspend_fork(fork_id: str) -> dict:
    """Suspend a running fork.

    Stops the fork's container but preserves all state and data.
    The fork can be resumed later.
    """
    provisioner = _get_provisioner()
    try:
        result = await provisioner.suspend_fork(fork_id)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Suspend failed: {exc}",
        )


@router.post("/{fork_id}/resume")
async def resume_fork(fork_id: str) -> dict:
    """Resume a suspended fork.

    Restarts the fork's container and restores it to active status.
    """
    provisioner = _get_provisioner()
    try:
        result = await provisioner.resume_fork(fork_id)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Resume failed: {exc}",
        )


@router.post("/{fork_id}/reduce")
async def trigger_reduction(fork_id: str) -> dict:
    """Trigger an ad-hoc reduction cycle for a fork.

    Runs the full engine pipeline: reduce -> represent -> materialize.
    Returns immediately with a status; the reduction runs in the background.
    """
    provisioner = _get_provisioner()
    try:
        result = await provisioner.trigger_reduction(fork_id)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reduction trigger failed: {exc}",
        )


@router.patch("/{fork_id}/config")
async def update_config(fork_id: str, request: UpdateConfigRequest) -> dict:
    """Update a fork's engine configuration.

    Only provided fields are updated; others remain unchanged.
    """
    provisioner = _get_provisioner()

    config_updates = {
        k: v
        for k, v in request.model_dump().items()
        if v is not None
    }

    if not config_updates:
        raise HTTPException(
            status_code=400,
            detail="No config fields provided",
        )

    try:
        result = await provisioner.update_fork_config(fork_id, config_updates)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Config update failed: {exc}",
        )


@router.get("/{fork_id}/health")
async def get_fork_health(fork_id: str) -> dict:
    """Get health score and metrics for a fork.

    Returns per-dimension scores (freshness, activity, errors,
    utilization) and a composite grade.
    """
    provisioner = _get_provisioner()
    health = await provisioner.get_fork_health(fork_id)

    if _health_scorer:
        score = _health_scorer.score(health)
        health["score"] = score

    return health


@router.get("/{fork_id}/usage")
async def get_fork_usage(
    fork_id: str,
    period_days: int = Query(30, ge=1, le=365),
) -> dict:
    """Get usage metrics for a fork over a time period.

    Returns aggregated counts of reductions, queries, API calls,
    and storage changes.
    """
    if _metering is None:
        raise HTTPException(
            status_code=503,
            detail="Metering service not initialized",
        )

    from datetime import timedelta

    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=period_days)

    usage = await _metering.get_usage(fork_id, period_start, period_end)
    return usage


@router.delete("/{fork_id}")
async def teardown_fork(fork_id: str) -> dict:
    """Teardown a fork — stops and removes the container.

    The customer's lo_* tables in their database are NOT dropped.
    This only removes the fork infrastructure.
    """
    provisioner = _get_provisioner()
    try:
        result = await provisioner.teardown_fork(fork_id)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Teardown failed: {exc}",
        )
