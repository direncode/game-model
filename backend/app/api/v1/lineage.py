"""Lineage endpoints: chain and graph retrieval."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.models.governance import LineageEvent
from app.schemas.governance import LineageEventResponse

router = APIRouter(prefix="/lineage", tags=["lineage"])


@router.get("/{subject_id}", response_model=list[LineageEventResponse])
async def get_lineage_chain(
    subject_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the lineage chain for a given subject (entity, dataset, job, etc.)."""
    result = await db.execute(
        select(LineageEvent)
        .where(LineageEvent.subject_id == subject_id)
        .order_by(LineageEvent.created_at.asc())
    )
    return result.scalars().all()


@router.get("/{subject_id}/graph", response_model=dict)
async def get_lineage_graph(
    subject_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full lineage graph rooted at a subject.

    Returns a dict with 'nodes' and 'edges' for graph visualization.
    """
    # Collect all events related to the subject
    result = await db.execute(
        select(LineageEvent)
        .where(LineageEvent.subject_id == subject_id)
        .order_by(LineageEvent.created_at.asc())
    )
    events = result.scalars().all()

    # Also fetch parent events transitively (one level up)
    parent_ids = [e.parent_event_id for e in events if e.parent_event_id is not None]
    parent_events = []
    if parent_ids:
        parent_result = await db.execute(
            select(LineageEvent).where(LineageEvent.id.in_(parent_ids))
        )
        parent_events = parent_result.scalars().all()

    all_events = {e.id: e for e in [*events, *parent_events]}

    nodes = [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "action": e.action,
            "actor_type": e.actor_type,
            "created_at": e.created_at.isoformat(),
        }
        for e in all_events.values()
    ]

    edges = [
        {"source": str(e.parent_event_id), "target": str(e.id)}
        for e in all_events.values()
        if e.parent_event_id is not None and e.parent_event_id in all_events
    ]

    return {"nodes": nodes, "edges": edges}
