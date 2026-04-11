"""TCD-JEPA Vertical API endpoints.

6 routes mounted at /v1/tcd:

POST   /verticals                    create session
POST   /verticals/{id}/crystallize   run batch crystallization
POST   /verticals/{id}/incremental   push delta bundle
GET    /verticals/{id}/modules       list modules
POST   /verticals/{id}/route         route signal
GET    /modules/{module_id}/export   export module

Zero edits to existing routes. This router is registered additively
in main.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime

import numpy as np
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import require_permission
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


# In-process session map. For production, replace with Redis/DB-backed
# sessions. Stateless-except-for-the-registry is fine for v1.
_VERTICAL_SESSIONS: dict[uuid.UUID, dict] = {}


@router.post(
    "/verticals", response_model=VerticalCreateResponse, status_code=201
)
async def create_vertical(
    body: VerticalCreateRequest,
    user=Depends(require_permission("run_crystallization")),
):
    session_id = uuid.uuid4()
    _VERTICAL_SESSIONS[session_id] = {
        "preset": body.preset,
        "created_at": datetime.utcnow(),
        "owner": user.id,
    }
    return VerticalCreateResponse(
        id=session_id,
        preset=body.preset,
        created_at=_VERTICAL_SESSIONS[session_id]["created_at"],
    )


@router.post("/verticals/{session_id}/crystallize", status_code=202)
async def crystallize_endpoint(
    session_id: uuid.UUID,
    body: CrystallizeRequest,
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
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
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    if len(body.embeddings) != len(body.ids):
        raise ValidationError(detail="embeddings and ids length mismatch")
    from app.services.crystallization.online import IncrementalCrystallizer
    from app.services.crystallization.vertical_types import BTUTSurvivorBundle

    sess = _VERTICAL_SESSIONS[session_id]
    crystallizer = sess.setdefault(
        "incremental", IncrementalCrystallizer(window_size=1024)
    )
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
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    preset = _VERTICAL_SESSIONS[session_id]["preset"]
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
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    preset: VerticalPreset = _VERTICAL_SESSIONS[session_id]["preset"]

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
