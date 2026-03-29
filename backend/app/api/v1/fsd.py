"""Franklin Street Data endpoints: cached modules + manual trigger."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends

from app.celery_app import celery_app
from app.config import settings
from app.core.auth import get_current_active_user

router = APIRouter(prefix="/fsd", tags=["fsd"])


def _get_redis():
    import redis
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@router.get("/modules")
async def get_fsd_modules(user=Depends(get_current_active_user)):
    """Return cached FSD crystallization results from Redis."""
    r = _get_redis()
    prefix = "fsd:latest"

    status = r.get(f"{prefix}:status")
    if not status:
        return {
            "status": "no_data",
            "message": "No FSD crystallization has been run yet.",
            "modules": [],
        }

    modules_json = r.get(f"{prefix}:modules")
    modules = json.loads(modules_json) if modules_json else []

    return {
        "status": status,
        "timestamp": r.get(f"{prefix}:timestamp"),
        "dataset_id": r.get(f"{prefix}:dataset_id"),
        "job_id": r.get(f"{prefix}:job_id"),
        "module_count": int(r.get(f"{prefix}:module_count") or 0),
        "modules": modules,
        "error": r.get(f"{prefix}:error"),
    }


@router.post("/crystallize", status_code=202)
async def trigger_fsd_crystallization(user=Depends(get_current_active_user)):
    """Manually trigger FSD crystallization (outside daily schedule)."""
    if not settings.FSD_ENABLED:
        return {"status": "disabled", "message": "FSD integration is not enabled. Set FSD_ENABLED=true."}

    task = celery_app.send_task(
        "fsd.daily_crystallize",
        queue="crystallization",
    )

    r = _get_redis()
    r.set("fsd:latest:status", "running")

    return {
        "status": "submitted",
        "task_id": task.id,
        "message": "FSD crystallization job submitted.",
    }


@router.get("/status")
async def get_fsd_status(user=Depends(get_current_active_user)):
    """Check FSD integration status and configuration."""
    return {
        "enabled": settings.FSD_ENABLED,
        "api_url": settings.FSD_API_URL,
        "snapshot_hours": settings.fsd_snapshot_hours_list,
        "cron_hour_utc": settings.FSD_DAILY_CRON_HOUR,
        "proximity_radius_m": settings.FSD_PROXIMITY_RADIUS_M,
        "correlation_threshold": settings.FSD_CORRELATION_THRESHOLD,
    }
