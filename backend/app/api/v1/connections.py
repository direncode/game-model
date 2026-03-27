"""Hidden connection endpoints: list and validate."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.module import HiddenConnection
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.module import ConnectionValidate, HiddenConnectionResponse

router = APIRouter(tags=["connections"])


@router.get(
    "/datasets/{dataset_id}/connections",
    response_model=PaginatedResponse[HiddenConnectionResponse],
)
async def list_connections(
    dataset_id: uuid.UUID,
    pagination: PaginationParams = Depends(),
    sort_by: str = Query(default="similarity_score", pattern="^(similarity_score|created_at)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List hidden connections for a dataset (paginated, sortable)."""
    from app.models.crystallization import CrystallizationJob

    offset = (pagination.page - 1) * pagination.per_page

    # Find connections through jobs for this dataset
    base_filter = (
        select(HiddenConnection)
        .join(CrystallizationJob, HiddenConnection.job_id == CrystallizationJob.id)
        .where(CrystallizationJob.dataset_id == dataset_id)
    )

    # Count
    count_q = (
        select(func.count())
        .select_from(HiddenConnection)
        .join(CrystallizationJob, HiddenConnection.job_id == CrystallizationJob.id)
        .where(CrystallizationJob.dataset_id == dataset_id)
    )
    total = (await db.execute(count_q)).scalar_one()

    # Sort
    sort_col = getattr(HiddenConnection, sort_by)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    q = base_filter.order_by(order).offset(offset).limit(pagination.per_page)
    result = await db.execute(q)
    connections = result.scalars().all()

    return PaginatedResponse[HiddenConnectionResponse].create(
        items=[HiddenConnectionResponse.model_validate(c) for c in connections],
        total=total,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.post("/connections/{connection_id}/validate", response_model=HiddenConnectionResponse)
async def validate_connection(
    connection_id: uuid.UUID,
    body: ConnectionValidate,
    user=Depends(require_permission("annotate_modules")),
    db: AsyncSession = Depends(get_db),
):
    """Validate or invalidate a hidden connection (analyst+ only)."""
    result = await db.execute(
        select(HiddenConnection).where(HiddenConnection.id == connection_id)
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise NotFoundError(detail="Connection not found")

    connection.validated = body.validated
    db.add(connection)
    await db.flush()
    await db.refresh(connection)
    return connection
