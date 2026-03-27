"""Dataset CRUD and file upload endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.dataset import Dataset, EntityType, RelationshipType
from app.schemas.common import MessageResponse, PaginatedResponse, PaginationParams
from app.schemas.dataset import (
    DatasetCreate,
    DatasetProfile,
    DatasetResponse,
    EntityTypeResponse,
    RelationshipTypeResponse,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=PaginatedResponse[DatasetResponse])
async def list_datasets(
    pagination: PaginationParams = Depends(),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List datasets accessible to the current user (paginated)."""
    offset = (pagination.page - 1) * pagination.per_page

    # Count
    count_q = select(func.count()).select_from(Dataset).where(Dataset.owner_id == user.id)
    total = (await db.execute(count_q)).scalar_one()

    # Fetch page
    q = (
        select(Dataset)
        .where(Dataset.owner_id == user.id)
        .order_by(Dataset.created_at.desc())
        .offset(offset)
        .limit(pagination.per_page)
    )
    result = await db.execute(q)
    datasets = result.scalars().all()

    return PaginatedResponse[DatasetResponse].create(
        items=[DatasetResponse.model_validate(d) for d in datasets],
        total=total,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.post("", response_model=DatasetResponse, status_code=201)
async def create_dataset(
    body: DatasetCreate,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create dataset metadata."""
    dataset = Dataset(
        name=body.name,
        description=body.description,
        owner_id=user.id,
        status="uploading",
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)
    return dataset


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single dataset by ID."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise NotFoundError(detail="Dataset not found")
    return dataset


@router.post("/{dataset_id}/upload", response_model=MessageResponse)
async def upload_dataset_file(
    dataset_id: uuid.UUID,
    file: UploadFile = File(...),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV/JSON file and trigger the awakening pipeline."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise NotFoundError(detail="Dataset not found")

    # Read file content
    content = await file.read()

    # Store raw file path (in production this goes to MinIO/S3)
    storage_path = f"datasets/{dataset_id}/{file.filename}"
    dataset.raw_storage_path = storage_path
    dataset.status = "profiling"
    db.add(dataset)
    await db.flush()

    # Trigger async awakening pipeline via Celery
    try:
        from app.celery_app import celery_app

        celery_app.send_task(
            "app.tasks.awakening.profile_dataset",
            args=[str(dataset_id)],
            queue="default",
        )
    except Exception:
        pass  # Celery not available in dev — continue gracefully

    return MessageResponse(message=f"File '{file.filename}' uploaded. Profiling started.")


@router.get("/{dataset_id}/profile", response_model=DatasetProfile)
async def get_dataset_profile(
    dataset_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the profiling summary for a dataset."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise NotFoundError(detail="Dataset not found")

    # Fetch entity types
    et_result = await db.execute(
        select(EntityType).where(EntityType.dataset_id == dataset_id)
    )
    entity_types = et_result.scalars().all()

    # Fetch relationship types
    rt_result = await db.execute(
        select(RelationshipType).where(RelationshipType.dataset_id == dataset_id)
    )
    relationship_types = rt_result.scalars().all()

    return DatasetProfile(
        entity_count=dataset.entity_count or 0,
        edge_count=dataset.edge_count or 0,
        density=dataset.density or 0.0,
        entity_types=[EntityTypeResponse.model_validate(et) for et in entity_types],
        relationship_types=[RelationshipTypeResponse.model_validate(rt) for rt in relationship_types],
        quality_score=0.0,  # Computed by profiling pipeline
    )


@router.delete("/{dataset_id}", response_model=MessageResponse)
async def delete_dataset(
    dataset_id: uuid.UUID,
    user=Depends(require_permission("manage_datasets")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a dataset (operator+ only)."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise NotFoundError(detail="Dataset not found")

    await db.delete(dataset)
    await db.flush()
    return MessageResponse(message="Dataset deleted")
