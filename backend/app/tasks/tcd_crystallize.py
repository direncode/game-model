"""TCD-JEPA vertical crystallization Celery task.

Runs the full TCDJEPAVertical pipeline (ingest → crystallize → interpret →
register) in a background worker. Dispatched by the /api/v1/tcd/verticals/
{session_id}/crystallize endpoint.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

import redis

from app.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)

_SESSION_PREFIX = "tcd_session:"
_RESULT_PREFIX = "tcd_result:"
_RESULT_TTL = 7 * 24 * 3600  # 7 days


def _get_sync_redis():
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@celery_app.task(
    bind=True,
    name="tcd_vertical.crystallize",
    queue="crystallization",
    max_retries=2,
    time_limit=14400,   # 4 hours hard limit
    soft_time_limit=13800,  # 3h50m soft limit
)
def crystallize_tcd_vertical_task(
    self,
    session_id: str,
    btut_job_id: str,
    min_quality: float = 0.0,
) -> dict:
    """Run the full TCD-JEPA crystallization pipeline in background.

    1. Load vertical session (preset) from Redis
    2. Load BTUT survivors via btut_job_id from the DB
    3. ingest_btut → crystallize → interpret → register
    4. Cache result summary in Redis
    """
    r = _get_sync_redis()
    r.set(f"{_RESULT_PREFIX}{session_id}:status", "running")
    r.set(f"{_RESULT_PREFIX}{session_id}:started_at", datetime.utcnow().isoformat())

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _run_pipeline(session_id, btut_job_id, min_quality)
            )
        finally:
            loop.close()

        # Cache results
        r.setex(
            f"{_RESULT_PREFIX}{session_id}:result",
            _RESULT_TTL,
            json.dumps(result, default=str),
        )
        r.set(f"{_RESULT_PREFIX}{session_id}:status", "completed")
        logger.info(
            "TCD vertical crystallization done: session=%s, modules=%d",
            session_id,
            result.get("module_count", 0),
        )
        return result

    except Exception as exc:
        logger.exception("TCD vertical crystallization failed: session=%s", session_id)
        r.set(f"{_RESULT_PREFIX}{session_id}:status", "failed")
        r.setex(
            f"{_RESULT_PREFIX}{session_id}:error",
            _RESULT_TTL,
            str(exc),
        )
        raise self.retry(exc=exc) if self.request.retries < self.max_retries else exc


async def _run_pipeline(
    session_id: str, btut_job_id: str, min_quality: float
) -> dict:
    """Async pipeline execution inside the Celery worker event loop."""
    import redis.asyncio as aioredis
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

    from app.config import settings as cfg
    from app.services.crystallization.btut_bridge import from_tuner_result
    from app.services.crystallization.module_registry import ModuleRegistryService
    from app.services.crystallization.vertical import TCDJEPAVertical
    from app.services.crystallization.vertical_types import VerticalPreset
    from app.services.crystallization.wrapper import TCDJEPAWrapper

    # ── Load session preset from Redis ───────────────────────────────
    ar = aioredis.from_url(cfg.REDIS_URL, decode_responses=True)
    try:
        raw = await ar.get(f"{_SESSION_PREFIX}{session_id}")
    finally:
        await ar.close()

    if raw is None:
        raise RuntimeError(f"TCD vertical session {session_id} not found in Redis")
    sess = json.loads(raw)
    preset = VerticalPreset(sess["preset"])

    # ── Load BTUT result from DB ─────────────────────────────────────
    engine = create_async_engine(cfg.DATABASE_URL, future=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        from sqlalchemy import select
        from app.models.btut import BTUTJob

        job_result = await db.execute(
            select(BTUTJob).where(BTUTJob.id == btut_job_id)
        )
        btut_job = job_result.scalar_one_or_none()
        if btut_job is None:
            raise RuntimeError(f"BTUT job {btut_job_id} not found")

        # Build bundle from stored result
        from app.services.crystallization.btut_bridge import from_pipeline_dict

        bundle = from_pipeline_dict(btut_job.result or {})

        # ── Run the vertical pipeline ────────────────────────────────
        wrapper = TCDJEPAWrapper()
        registry = ModuleRegistryService(db)

        vertical = TCDJEPAVertical(
            preset=preset,
            wrapper=wrapper,
            registry_service=registry,
        )
        vertical.ingest_btut(bundle)

        modules = await vertical.crystallize()

        # Filter by quality
        if min_quality > 0:
            modules = [m for m in modules if m.quality_score >= min_quality]

        # Interpret
        annotated = await vertical.interpret(modules)

        # Register to persistent DB
        registered = await vertical.register(modules)
        await db.commit()

    await engine.dispose()

    return {
        "session_id": session_id,
        "btut_job_id": btut_job_id,
        "preset": preset.value,
        "module_count": len(registered),
        "completed_at": datetime.utcnow().isoformat(),
    }
