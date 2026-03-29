"""Crystallization job endpoints: trigger, status, metrics, cancel."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.crystallization import CrystallizationJob, TrainingMetric
from app.models.dataset import Dataset
from app.schemas.common import MessageResponse
from app.schemas.crystallization import (
    CrystallizationConfig,
    CrystallizationJobResponse,
    TrainingMetricResponse,
)

router = APIRouter(tags=["crystallization"])


@router.post(
    "/datasets/{dataset_id}/crystallize",
    response_model=CrystallizationJobResponse,
    status_code=201,
)
async def trigger_crystallization(
    dataset_id: uuid.UUID,
    config: CrystallizationConfig | None = None,
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a crystallization job for a dataset (operator+ only)."""
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise NotFoundError(detail="Dataset not found")

    if dataset.status not in ("ready", "complete", "crystallizing"):
        raise ValidationError(
            detail=f"Dataset must be in 'ready', 'complete', or 'crystallizing' status, currently '{dataset.status}'"
        )

    config_dict = config.model_dump(exclude_none=True) if config else {}

    job = CrystallizationJob(
        dataset_id=dataset_id,
        status="queued",
        config=config_dict,
        created_by=user.id,
    )
    db.add(job)
    await db.flush()

    # Keep dataset status as-is (don't set to crystallizing since the
    # Celery worker will update it when it actually starts processing)
    await db.flush()
    await db.refresh(job)

    # Dispatch Celery task
    try:
        from app.celery_app import celery_app

        celery_app.send_task(
            "crystallization.run",
            args=[str(job.id)],
            queue="crystallization",
        )
    except Exception:
        pass

    return job


@router.get("/crystallization/{job_id}", response_model=CrystallizationJobResponse)
async def get_job_status(
    job_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get crystallization job status."""
    result = await db.execute(
        select(CrystallizationJob).where(CrystallizationJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError(detail="Crystallization job not found")
    return job


@router.get(
    "/crystallization/{job_id}/metrics",
    response_model=list[TrainingMetricResponse],
)
async def get_training_metrics(
    job_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get training metrics time series for a job."""
    # Verify job exists
    job_result = await db.execute(
        select(CrystallizationJob).where(CrystallizationJob.id == job_id)
    )
    if job_result.scalar_one_or_none() is None:
        raise NotFoundError(detail="Crystallization job not found")

    result = await db.execute(
        select(TrainingMetric)
        .where(TrainingMetric.job_id == job_id)
        .order_by(TrainingMetric.epoch, TrainingMetric.step)
    )
    return result.scalars().all()


@router.post("/crystallization/{job_id}/cancel", response_model=MessageResponse)
async def cancel_job(
    job_id: uuid.UUID,
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running crystallization job."""
    result = await db.execute(
        select(CrystallizationJob).where(CrystallizationJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError(detail="Crystallization job not found")

    if job.status not in ("queued", "running"):
        raise ValidationError(detail=f"Cannot cancel job in '{job.status}' status")

    job.status = "cancelled"
    db.add(job)
    await db.flush()

    # Attempt to revoke Celery task
    try:
        from app.celery_app import celery_app

        celery_app.control.revoke(str(job.id), terminate=True)
    except Exception:
        pass

    return MessageResponse(message="Job cancelled")


@router.get("/gpu/spend")
async def get_gpu_spend(user=Depends(get_current_active_user)):
    """Get current month's GPU spend and budget status."""
    from app.services.crystallization.runpod_client import is_runpod_configured

    if not is_runpod_configured():
        return {
            "enabled": False,
            "message": "GPU compute not configured",
        }

    from app.services.crystallization.runpod_client import SpendTracker

    tracker = SpendTracker()
    spent_cents = tracker.get_month_spend_cents()
    budget_cents = settings.RUNPOD_MONTHLY_BUDGET_CENTS

    return {
        "enabled": True,
        "spent_dollars": round(spent_cents / 100, 2),
        "budget_dollars": round(budget_cents / 100, 2),
        "remaining_dollars": round((budget_cents - spent_cents) / 100, 2),
        "utilization_pct": round((spent_cents / budget_cents) * 100, 1) if budget_cents else 0,
    }
