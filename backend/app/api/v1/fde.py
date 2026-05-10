"""FDE workspace API — Layer 10.

Endpoints for the Forward Deployed Engineer workspace. These power the
/fde page and are scoped to users with the ``admin`` API key scope
(internal-only). The data model is intentionally minimal so the
workspace is usable before full CRM integration lands.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.api_key_auth import require_api_scope
from app.services.fde import (
    Engagement,
    EngagementStatus,
    get_engagement,
    list_engagements,
    upsert_engagement,
)


router = APIRouter(prefix="/fde", tags=["fde"])


class EngagementOut(BaseModel):
    id: str
    org_id: str
    customer_name: str
    status: str
    primary_fde: str
    started_at: float
    last_update_at: float
    workflows_built: int
    custom_operators_deployed: int
    notes: str
    open_items: list[str]


class UpsertEngagement(BaseModel):
    id: str | None = None
    org_id: str = Field(..., min_length=1)
    customer_name: str = Field(..., min_length=1, max_length=200)
    status: str = Field(..., description="scoping | active | handed_off | paused | closed")
    primary_fde: str = Field(..., max_length=200)
    notes: str = ""
    workflows_built: int = 0
    custom_operators_deployed: int = 0
    open_items: list[str] = Field(default_factory=list)


def _to_out(e: Engagement) -> EngagementOut:
    d = e.to_dict()
    return EngagementOut(**d)


@router.get("/engagements", response_model=list[EngagementOut])
async def list_engagements_endpoint(
    status: str | None = None,
    org_id: str | None = None,
    _: dict = Depends(require_api_scope("admin")),
) -> list[EngagementOut]:
    """List engagements. Filter by ``status`` and/or ``org_id``."""
    engagements = await list_engagements(status=status, org_id=org_id)
    return [_to_out(e) for e in engagements]


@router.get("/engagements/{engagement_id}", response_model=EngagementOut)
async def get_engagement_endpoint(
    engagement_id: str,
    _: dict = Depends(require_api_scope("admin")),
) -> EngagementOut:
    e = await get_engagement(engagement_id)
    if e is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    return _to_out(e)


@router.post("/engagements", response_model=EngagementOut)
async def upsert_engagement_endpoint(
    req: UpsertEngagement,
    _: dict = Depends(require_api_scope("admin")),
) -> EngagementOut:
    valid_states = {s.value for s in EngagementStatus}
    if req.status not in valid_states:
        raise HTTPException(
            status_code=422,
            detail=f"invalid status; must be one of: {sorted(valid_states)}",
        )
    try:
        eng = await upsert_engagement(
            engagement_id=req.id,
            org_id=req.org_id,
            customer_name=req.customer_name,
            status=req.status,
            primary_fde=req.primary_fde,
            notes=req.notes,
            workflows_built=req.workflows_built,
            custom_operators_deployed=req.custom_operators_deployed,
            open_items=req.open_items,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return _to_out(eng)
