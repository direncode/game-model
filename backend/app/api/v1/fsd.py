"""Franklin Street Data endpoints: cached modules + manual trigger.

Read path: Redis cache → Postgres fallback → re-warm cache.
Modules are always returned sorted by entity_count descending so the
largest clusters (e.g. Restaurant · 6Pm, 65 venues) surface first.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.config import settings
from app.core.auth import get_current_active_user
from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fsd", tags=["fsd"])

FSD_CACHE_PREFIX = "fsd:latest"
FSD_CACHE_TTL = 86_400  # 24 hours


def _get_redis():
    import redis
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def _sort_modules(modules: list[dict]) -> list[dict]:
    """Sort modules by entity_count descending (largest clusters first)."""
    return sorted(modules, key=lambda m: m.get("entity_count", 0), reverse=True)


def _warm_redis_cache(r, *, status: str, timestamp: str, dataset_id: str,
                      job_id: str, module_count: int, modules: list[dict]):
    """Re-populate Redis cache from Postgres data."""
    r.set(f"{FSD_CACHE_PREFIX}:status", status)
    r.set(f"{FSD_CACHE_PREFIX}:timestamp", timestamp)
    r.set(f"{FSD_CACHE_PREFIX}:dataset_id", dataset_id)
    r.set(f"{FSD_CACHE_PREFIX}:job_id", job_id)
    r.set(f"{FSD_CACHE_PREFIX}:module_count", str(module_count))
    r.set(f"{FSD_CACHE_PREFIX}:modules", json.dumps(modules))
    for suffix in ("status", "timestamp", "dataset_id", "job_id", "module_count", "modules"):
        r.expire(f"{FSD_CACHE_PREFIX}:{suffix}", FSD_CACHE_TTL)


async def _fallback_from_postgres(db: AsyncSession) -> dict | None:
    """Load the latest completed crystallization from Postgres.

    Returns a response dict or None if no completed job exists.
    """
    from app.models.crystallization import CrystallizationJob
    from app.models.module import Module

    # Find the most recent completed FSD job
    job_result = await db.execute(
        select(CrystallizationJob)
        .where(CrystallizationJob.status == "completed")
        .order_by(CrystallizationJob.completed_at.desc())
        .limit(1)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        return None

    # Load modules for that job's dataset
    modules_result = await db.execute(
        select(Module).where(Module.dataset_id == job.dataset_id)
    )
    modules = modules_result.scalars().all()

    module_summaries = [
        {
            "id": str(m.id),
            "name": m.name,
            "module_index": m.module_index,
            "entity_count": m.entity_count,
            "dominant_type": m.dominant_type,
            "purity_score": m.purity_score,
        }
        for m in modules
    ]

    timestamp = (job.completed_at or job.created_at).isoformat()

    return {
        "status": "completed",
        "timestamp": timestamp,
        "dataset_id": str(job.dataset_id),
        "job_id": str(job.id),
        "module_count": len(module_summaries),
        "modules": _sort_modules(module_summaries),
    }


@router.get("/modules")
async def get_fsd_modules(
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return FSD crystallization results.

    Read-through cache: tries Redis first, falls back to Postgres
    and re-warms the cache on hit. Modules are always sorted by size.
    """
    r = _get_redis()

    status = r.get(f"{FSD_CACHE_PREFIX}:status")
    if status:
        # Cache hit — serve from Redis
        modules_json = r.get(f"{FSD_CACHE_PREFIX}:modules")
        modules = json.loads(modules_json) if modules_json else []
        return {
            "status": status,
            "timestamp": r.get(f"{FSD_CACHE_PREFIX}:timestamp"),
            "dataset_id": r.get(f"{FSD_CACHE_PREFIX}:dataset_id"),
            "job_id": r.get(f"{FSD_CACHE_PREFIX}:job_id"),
            "module_count": int(r.get(f"{FSD_CACHE_PREFIX}:module_count") or 0),
            "modules": _sort_modules(modules),
            "error": r.get(f"{FSD_CACHE_PREFIX}:error"),
        }

    # Cache miss — fall back to Postgres
    logger.info("Redis cache miss for FSD modules, falling back to Postgres")
    pg_data = await _fallback_from_postgres(db)

    if pg_data is None:
        return {
            "status": "no_data",
            "message": "No FSD crystallization has been run yet.",
            "modules": [],
        }

    # Re-warm Redis cache so next request is fast
    _warm_redis_cache(r, **pg_data)
    logger.info("Re-warmed Redis cache from Postgres (%d modules)", pg_data["module_count"])

    return pg_data


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
