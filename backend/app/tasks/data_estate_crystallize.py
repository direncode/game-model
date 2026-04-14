"""Celery task for Data Estate crystallization.

Triggered when a submission is approved. Runs the full pipeline:
text -> entities -> BTUT -> TCD-JEPA -> module registry.
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

_RESULT_PREFIX = "estate_result:"
_RESULT_TTL = 7 * 24 * 3600  # 7 days


def _get_sync_redis():
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@celery_app.task(
    bind=True,
    name="data_estate.crystallize",
    queue="crystallization",
    max_retries=2,
    time_limit=7200,  # 2 hours hard limit
    soft_time_limit=6900,  # 1h55m soft limit
)
def crystallize_estate_task(
    self,
    submission_id: str,
    org_id: str,
) -> dict:
    """Run the estate ingestion pipeline for an approved submission."""
    r = _get_sync_redis()
    r.set(f"{_RESULT_PREFIX}{submission_id}:status", "running")
    r.set(f"{_RESULT_PREFIX}{submission_id}:started_at", datetime.utcnow().isoformat())

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _run_pipeline(submission_id, org_id)
            )
        finally:
            loop.close()

        r.setex(
            f"{_RESULT_PREFIX}{submission_id}:result",
            _RESULT_TTL,
            json.dumps(result, default=str),
        )
        r.set(f"{_RESULT_PREFIX}{submission_id}:status", "completed")
        logger.info(
            "Estate crystallization done: submission=%s, modules=%d",
            submission_id,
            result.get("module_count", 0),
        )
        return result

    except Exception as exc:
        logger.exception(
            "Estate crystallization failed: submission=%s", submission_id
        )
        r.set(f"{_RESULT_PREFIX}{submission_id}:status", "failed")
        r.setex(
            f"{_RESULT_PREFIX}{submission_id}:error",
            _RESULT_TTL,
            str(exc),
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        raise


async def _run_pipeline(submission_id: str, org_id: str) -> dict:
    """Async pipeline execution inside the Celery worker."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.models.data_estate import EstateSubmission
    from app.models.module_registry import ModuleRegistryEntry
    from app.services.crystallization.module_registry import ModuleRegistryService
    from app.services.data_estate.ingestion_pipeline import run_estate_pipeline

    engine = create_async_engine(settings.DATABASE_URL, future=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        from sqlalchemy import select

        # Load submission
        result = await db.execute(
            select(EstateSubmission).where(
                EstateSubmission.id == submission_id
            )
        )
        submission = result.scalar_one_or_none()
        if not submission:
            raise RuntimeError(f"Submission {submission_id} not found")

        # Run the pipeline
        registry = ModuleRegistryService(db)
        pipeline_result = await run_estate_pipeline(
            raw_text=submission.raw_text,
            doc_id=str(submission.id),
            registry_service=registry,
        )

        await db.commit()

    await engine.dispose()
    return pipeline_result
