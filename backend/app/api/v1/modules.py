"""Module endpoints: list, detail, entities, update."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.module import Module, ModuleEntity
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.module import (
    ModuleDetailResponse,
    ModuleEntityResponse,
    ModuleResponse,
    ModuleUpdate,
)

router = APIRouter(tags=["modules"])


@router.get("/datasets/{dataset_id}/modules", response_model=list[ModuleResponse])
async def list_modules(
    dataset_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all modules for a dataset."""
    result = await db.execute(
        select(Module)
        .where(Module.dataset_id == dataset_id)
        .order_by(Module.module_index)
    )
    return result.scalars().all()


@router.get("/modules/{module_id}", response_model=ModuleDetailResponse)
async def get_module_detail(
    module_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get module detail with entities."""
    result = await db.execute(
        select(Module)
        .options(selectinload(Module.entities))
        .where(Module.id == module_id)
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise NotFoundError(detail="Module not found")
    return module


@router.get(
    "/modules/{module_id}/entities",
    response_model=PaginatedResponse[ModuleEntityResponse],
)
async def list_module_entities(
    module_id: uuid.UUID,
    pagination: PaginationParams = Depends(),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List entities in a module (paginated)."""
    # Verify module exists
    mod_result = await db.execute(select(Module).where(Module.id == module_id))
    if mod_result.scalar_one_or_none() is None:
        raise NotFoundError(detail="Module not found")

    offset = (pagination.page - 1) * pagination.per_page

    count_q = (
        select(func.count())
        .select_from(ModuleEntity)
        .where(ModuleEntity.module_id == module_id)
    )
    total = (await db.execute(count_q)).scalar_one()

    q = (
        select(ModuleEntity)
        .where(ModuleEntity.module_id == module_id)
        .order_by(ModuleEntity.centrality_score.desc().nullslast())
        .offset(offset)
        .limit(pagination.per_page)
    )
    result = await db.execute(q)
    entities = result.scalars().all()

    return PaginatedResponse[ModuleEntityResponse].create(
        items=[ModuleEntityResponse.model_validate(e) for e in entities],
        total=total,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.put("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(
    module_id: uuid.UUID,
    body: ModuleUpdate,
    user=Depends(require_permission("annotate_modules")),
    db: AsyncSession = Depends(get_db),
):
    """Update module name/description (analyst+ only)."""
    result = await db.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if module is None:
        raise NotFoundError(detail="Module not found")

    if body.name is not None:
        module.name = body.name
    if body.description is not None:
        module.description = body.description

    db.add(module)
    await db.flush()
    await db.refresh(module)
    return module
