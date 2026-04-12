"""TCD-JEPA Vertical API endpoints.

6 routes mounted at /v1/tcd:

POST   /verticals                    create session
POST   /verticals/{id}/crystallize   run batch crystallization
POST   /verticals/{id}/incremental   push delta bundle
GET    /verticals/{id}/modules       list modules
POST   /verticals/{id}/route         route signal
GET    /modules/{module_id}/export   export module

Sessions stored in Redis (key prefix `tcd_session:`). Survives
multi-worker deployments and server restarts within the 7-day TTL.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime

import numpy as np
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import require_permission
from app.core.redis import get_redis
from app.db.session import get_db
from app.schemas.tcd_vertical import (
    CrystallizeRequest,
    IncrementalPushRequest,
    ModuleListResponse,
    ModuleResponse,
    RouteDecisionResponse,
    RouteRequest,
    RouteResponse,
    VerticalCreateRequest,
    VerticalCreateResponse,
)
from app.services.crystallization.export import (
    ExportFormat,
    to_json,
    to_onnx,
    to_pytorch_bundle,
)
from app.services.crystallization.module_registry import ModuleRegistryService
from app.services.crystallization.routing import route_signal
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    VerticalPreset,
)

router = APIRouter(tags=["tcd-vertical"])

_SESSION_PREFIX = "tcd_session:"
_SESSION_TTL = 7 * 24 * 3600  # 7 days

# In-memory incremental crystallizer cache. Stateful (holds the numpy
# sliding window), so it can't be serialized to Redis. Keyed by
# session_id str. Lost on restart — that's acceptable for incremental
# pushes, which are by definition ephemeral streaming operations.
_INCREMENTAL_CACHE: dict[str, "IncrementalCrystallizer"] = {}


async def _get_session(session_id: uuid.UUID) -> dict:
    """Retrieve a TCD vertical session from Redis or raise 404."""
    r = await get_redis()
    raw = await r.get(f"{_SESSION_PREFIX}{session_id}")
    if raw is None:
        raise NotFoundError(detail="vertical session not found")
    return json.loads(raw)


async def _set_session(session_id: uuid.UUID, data: dict) -> None:
    """Store a TCD vertical session in Redis with TTL."""
    r = await get_redis()
    await r.setex(
        f"{_SESSION_PREFIX}{session_id}",
        _SESSION_TTL,
        json.dumps(data, default=str),
    )


@router.post(
    "/verticals", response_model=VerticalCreateResponse, status_code=201
)
async def create_vertical(
    body: VerticalCreateRequest,
    user=Depends(require_permission("run_crystallization")),
):
    session_id = uuid.uuid4()
    now = datetime.utcnow()
    await _set_session(session_id, {
        "preset": body.preset.value,
        "created_at": now.isoformat(),
        "owner": str(user.id),
    })
    return VerticalCreateResponse(
        id=session_id, preset=body.preset, created_at=now,
    )


@router.post("/verticals/{session_id}/crystallize", status_code=202)
async def crystallize_endpoint(
    session_id: uuid.UUID,
    body: CrystallizeRequest,
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    await _get_session(session_id)  # validates session exists in Redis

    from app.celery_app import celery_app

    celery_app.send_task(
        "tcd_vertical.crystallize",
        args=[str(session_id), str(body.btut_job_id)],
        kwargs={"min_quality": body.min_quality},
        queue="crystallization",
    )
    return {
        "session_id": str(session_id),
        "btut_job_id": str(body.btut_job_id),
        "status": "queued",
    }


@router.post("/verticals/{session_id}/incremental", status_code=200)
async def incremental_endpoint(
    session_id: uuid.UUID,
    body: IncrementalPushRequest,
    user=Depends(require_permission("run_crystallization")),
):
    await _get_session(session_id)
    if len(body.embeddings) != len(body.ids):
        raise ValidationError(detail="embeddings and ids length mismatch")

    from app.services.crystallization.online import IncrementalCrystallizer
    from app.services.crystallization.vertical_types import BTUTSurvivorBundle

    sid = str(session_id)
    if sid not in _INCREMENTAL_CACHE:
        _INCREMENTAL_CACHE[sid] = IncrementalCrystallizer(window_size=1024)
    crystallizer = _INCREMENTAL_CACHE[sid]

    bundle = BTUTSurvivorBundle(
        embeddings=np.asarray(body.embeddings, dtype=np.float32),
        ids=body.ids,
        edges=[],
        metadata={},
    )
    novel = crystallizer.push(bundle)
    return {
        "session_id": str(session_id),
        "pushed": len(body.ids),
        "novel_feature_count": len(novel),
        "window_size": crystallizer.window_length(),
    }


@router.get(
    "/verticals/{session_id}/modules", response_model=ModuleListResponse
)
async def list_modules_endpoint(
    session_id: uuid.UUID,
    min_purity: float = Query(0.0, ge=0.0, le=1.0),
    min_quality: float = Query(0.0, ge=0.0, le=1.0),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    sess = await _get_session(session_id)
    preset = VerticalPreset(sess["preset"])
    svc = ModuleRegistryService(db)
    rows = await svc.list(
        vertical=preset, min_purity=min_purity, min_quality=min_quality
    )
    modules = [
        ModuleResponse(
            id=r.id,
            vertical=r.vertical,
            module_type=r.module_type,
            purity=r.purity,
            quality_score=r.quality_score,
            members=r.members,
            provenance_job_id=r.provenance_job_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return ModuleListResponse(modules=modules, total=len(modules))


@router.post("/verticals/{session_id}/route", response_model=RouteResponse)
async def route_endpoint(
    session_id: uuid.UUID,
    body: RouteRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    sess = await _get_session(session_id)
    preset = VerticalPreset(sess["preset"])

    svc = ModuleRegistryService(db)
    rows = await svc.list(vertical=preset)
    known_modules = [
        CrystallizedModule(
            id=str(r.id),
            vertical=VerticalPreset(r.vertical),
            module_type=r.module_type,
            centroid=np.asarray(r.centroid, dtype=np.float32),
            members=r.members,
            purity=r.purity,
            quality_score=r.quality_score,
            provenance_job_id=r.provenance_job_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
    signal = np.asarray(body.signal, dtype=np.float32)
    decisions = route_signal(signal, known_modules, top_k=body.top_k)
    return RouteResponse(
        decisions=[
            RouteDecisionResponse(
                module_id=d.module_id, score=d.score, reason=d.reason
            )
            for d in decisions
        ]
    )


@router.get("/modules/{module_id}/export")
async def export_endpoint(
    module_id: uuid.UUID,
    format: str = Query("json", pattern="^(json|pt|onnx)$"),
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    svc = ModuleRegistryService(db)
    row = await svc.get(module_id)
    if row is None:
        raise NotFoundError(detail="module not found")

    module = CrystallizedModule(
        id=str(row.id),
        vertical=VerticalPreset(row.vertical),
        module_type=row.module_type,
        centroid=np.asarray(row.centroid, dtype=np.float32),
        members=row.members,
        purity=row.purity,
        quality_score=row.quality_score,
        provenance_job_id=row.provenance_job_id,
        created_at=row.created_at,
    )

    try:
        fmt = ExportFormat(format)
    except ValueError:
        raise ValidationError(detail=f"unknown format: {format}")

    if fmt == ExportFormat.JSON:
        blob = to_json(module)
        return Response(content=blob, media_type="application/json")
    if fmt == ExportFormat.PYTORCH:
        blob = to_pytorch_bundle(module)
        return Response(
            content=blob,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{module_id}.pt"'
            },
        )
    raise ValidationError(detail="onnx export not yet implemented")


# ══════════════════════════════════════════════════════════════════
# DEMO ENDPOINT
# ══════════════════════════════════════════════════════════════════


@router.post("/verticals/demo", status_code=202)
async def start_demo():
    """Launch the auto-demo pipeline (no auth required for demos)."""
    import asyncio

    session_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    # Store session in Redis
    await _set_session(uuid.UUID(session_id), {
        "preset": "trading",
        "created_at": datetime.utcnow().isoformat(),
        "owner": "demo",
        "demo": True,
    })

    # Launch demo in background (not Celery — must be fast + local)
    from app.services.crystallization.demo_runner import run_demo

    asyncio.create_task(run_demo(session_id, job_id))

    return {
        "session_id": session_id,
        "job_id": job_id,
        "ws_url": f"/ws/crystallization/{job_id}",
    }


# ══════════════════════════════════════════════════════════════════
# INTELLIGENCE ENDPOINTS
# ══════════════════════════════════════════════════════════════════


@router.get("/verticals/{session_id}/intelligence")
async def intelligence_summary(
    session_id: uuid.UUID,
    user=Depends(get_current_active_user),
):
    """Get all 7 intelligence engine results for a session."""
    from app.services.crystallization import intelligence_cache
    from app.schemas.tcd_vertical import (
        IntelligenceEngineResponse,
        IntelligenceInsightResponse,
        IntelligenceSummaryResponse,
    )

    all_results = await intelligence_cache.get_all_results(str(session_id))
    if not all_results:
        raise NotFoundError(detail="No intelligence data — run demo or crystallization first")

    engines = {}
    total = 0
    for eng, insights in all_results.items():
        if eng == "convergence_history":
            continue
        parsed = [IntelligenceInsightResponse(**i) for i in insights]
        engines[eng] = IntelligenceEngineResponse(
            engine=eng, insights=parsed, insight_count=len(parsed)
        )
        total += len(parsed)

    return IntelligenceSummaryResponse(engines=engines, total_insights=total)


@router.get("/verticals/{session_id}/intelligence/{engine}")
async def intelligence_engine(
    session_id: uuid.UUID,
    engine: str,
    user=Depends(get_current_active_user),
):
    """Get results from a single intelligence engine."""
    from app.services.crystallization import intelligence_cache
    from app.schemas.tcd_vertical import (
        IntelligenceEngineResponse,
        IntelligenceInsightResponse,
    )

    valid = {"deep_signals", "causal", "topological", "temporal", "meta", "oracle", "uncertainty", "convergence_history"}
    if engine.replace("-", "_") not in valid:
        raise ValidationError(detail=f"Unknown engine: {engine}")

    engine_key = engine.replace("-", "_")
    result = await intelligence_cache.get_engine_result(str(session_id), engine_key)
    if result is None:
        raise NotFoundError(detail=f"No {engine} data — run demo first")

    if engine_key == "convergence_history":
        return {"engine": "convergence_history", "data": result}

    parsed = [IntelligenceInsightResponse(**i) for i in result]
    return IntelligenceEngineResponse(
        engine=engine_key, insights=parsed, insight_count=len(parsed)
    )


# ══════════════════════════════════════════════════════════════════
# AI AGENT ENDPOINT
# ══════════════════════════════════════════════════════════════════


@router.post("/verticals/{session_id}/agent/query")
async def agent_query_endpoint(
    session_id: uuid.UUID,
    body: dict,
    user=Depends(get_current_active_user),
):
    """Ask the TCD-JEPA AI agent a question about the crystallization."""
    from app.services.crystallization.agent import query_agent

    question = body.get("question", "")
    if not question:
        raise ValidationError(detail="question is required")

    result = await query_agent(str(session_id), question)
    return result


# ══════════════════════════════════════════════════════════════════
# MARKETPLACE ENDPOINTS
# ══════════════════════════════════════════════════════════════════


@router.get("/verticals/{session_id}/marketplace")
async def marketplace_endpoint(
    session_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all modules with pricing for the marketplace."""
    from app.services.crystallization.marketplace import estimate_price

    sess = await _get_session(session_id)
    preset = VerticalPreset(sess["preset"])
    svc = ModuleRegistryService(db)
    rows = await svc.list(vertical=preset)

    modules = []
    for r in rows:
        pricing = estimate_price(r)
        modules.append({
            "id": str(r.id),
            "vertical": r.vertical,
            "module_type": r.module_type,
            "purity": r.purity,
            "quality_score": r.quality_score,
            "members": r.members,
            "price_credits": pricing["price_credits"],
            "tier": pricing["tier"],
        })
    return {"modules": modules, "total": len(modules)}


@router.get("/modules/{module_id}/pricing")
async def module_pricing_endpoint(
    module_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pricing for a single module."""
    from app.services.crystallization.marketplace import estimate_price

    svc = ModuleRegistryService(db)
    row = await svc.get(module_id)
    if row is None:
        raise NotFoundError(detail="module not found")
    pricing = estimate_price(row)
    return {"module_id": str(module_id), **pricing}


@router.post("/modules/{module_id}/license")
async def license_module_endpoint(
    module_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a license key for a module."""
    from app.services.crystallization.marketplace import generate_license_key

    svc = ModuleRegistryService(db)
    row = await svc.get(module_id)
    if row is None:
        raise NotFoundError(detail="module not found")
    return generate_license_key(str(module_id))
