"""Report generation and retrieval endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.crystallization import CrystallizationJob
from app.models.dataset import Dataset
from app.models.delivery import Report
from app.schemas.delivery import ReportGenerateRequest, ReportResponse

router = APIRouter(tags=["reports"])


@router.post(
    "/datasets/{dataset_id}/reports",
    response_model=ReportResponse,
    status_code=201,
)
async def generate_report(
    dataset_id: uuid.UUID,
    body: ReportGenerateRequest,
    user=Depends(require_permission("export_reports")),
    db: AsyncSession = Depends(get_db),
):
    """Generate a report for a dataset (analyst+ only)."""
    # Verify dataset
    ds_result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = ds_result.scalar_one_or_none()
    if dataset is None:
        raise NotFoundError(detail="Dataset not found")

    # Find latest completed job
    job_result = await db.execute(
        select(CrystallizationJob)
        .where(
            CrystallizationJob.dataset_id == dataset_id,
            CrystallizationJob.status == "completed",
        )
        .order_by(CrystallizationJob.completed_at.desc())
        .limit(1)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        raise NotFoundError(detail="No completed crystallization job found for this dataset")

    title = f"{body.report_type.replace('_', ' ').title()} — {dataset.name}"
    storage_path = f"reports/{dataset_id}/{job.id}/{body.report_type}.{body.format}"

    report = Report(
        dataset_id=dataset_id,
        job_id=job.id,
        report_type=body.report_type,
        title=title,
        format=body.format,
        storage_path=storage_path,
        generated_by=user.id,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    # Dispatch async report generation
    try:
        from app.celery_app import celery_app

        celery_app.send_task(
            "app.tasks.reports.generate_report",
            args=[str(report.id)],
            queue="reports",
        )
    except Exception:
        pass

    return report


@router.get("/reports", response_model=list[ReportResponse])
async def list_reports(
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reports accessible to the current user."""
    result = await db.execute(
        select(Report)
        .where(Report.generated_by == user.id)
        .order_by(Report.generated_at.desc())
    )
    return result.scalars().all()


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a generated report file."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise NotFoundError(detail="Report not found")

    # In production, generate a presigned URL from MinIO/S3
    return JSONResponse(
        content={
            "report_id": str(report.id),
            "title": report.title,
            "format": report.format,
            "download_url": f"/storage/{report.storage_path}",
        }
    )
