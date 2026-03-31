"""Daily FSD crystallization task.

Fetches Franklin Street Data, builds an entity-relationship graph via the
FSD adapter, runs it through the awakening pipeline, triggers crystallization
on RunPod GPU, and caches the results in Redis with a 24-hour TTL.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone

from app.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)

# Redis key prefix for cached FSD results
FSD_CACHE_PREFIX = "fsd:latest"
FSD_CACHE_TTL = 86_400  # 24 hours

# Well-known name for the FSD dataset
FSD_DATASET_NAME = "Franklin Street Data"


def _get_redis():
    import redis
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@celery_app.task(
    bind=True,
    name="fsd.daily_crystallize",
    queue="crystallization",
    max_retries=1,
    time_limit=7200,  # 2 hours hard limit
    soft_time_limit=6600,  # 1h50m soft limit
)
def daily_crystallize_fsd(self) -> dict:
    """Orchestrate the full FSD crystallization cycle.

    1. Fetch FSD data at 4 strategic hours
    2. Build entity-relationship graph
    3. Ingest via awakening pipeline
    4. Trigger crystallization (RunPod GPU if configured)
    5. Cache results in Redis
    """
    logger.info("Starting FSD daily crystallization")

    r = _get_redis()
    r.set(f"{FSD_CACHE_PREFIX}:status", "running")

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_run_fsd_pipeline())
        finally:
            loop.close()

        # Cache results
        r.set(f"{FSD_CACHE_PREFIX}:status", "completed")
        r.set(f"{FSD_CACHE_PREFIX}:timestamp", datetime.now(timezone.utc).isoformat())
        r.set(f"{FSD_CACHE_PREFIX}:dataset_id", result["dataset_id"])
        r.set(f"{FSD_CACHE_PREFIX}:job_id", result.get("job_id", ""))
        r.set(f"{FSD_CACHE_PREFIX}:module_count", str(result.get("module_count", 0)))
        r.set(f"{FSD_CACHE_PREFIX}:modules", json.dumps(result.get("modules", [])))

        # Set TTL on all keys
        for suffix in ("status", "timestamp", "dataset_id", "job_id", "module_count", "modules"):
            r.expire(f"{FSD_CACHE_PREFIX}:{suffix}", FSD_CACHE_TTL)

        logger.info("FSD daily crystallization completed: %s", result)
        return result

    except Exception as exc:
        logger.exception("FSD daily crystallization failed")
        r.set(f"{FSD_CACHE_PREFIX}:status", "failed")
        r.set(f"{FSD_CACHE_PREFIX}:error", str(exc))
        r.expire(f"{FSD_CACHE_PREFIX}:status", FSD_CACHE_TTL)
        r.expire(f"{FSD_CACHE_PREFIX}:error", FSD_CACHE_TTL)
        raise


async def _run_fsd_pipeline() -> dict:
    """Async implementation of the FSD pipeline."""
    from sqlalchemy import select

    from app.db.neo4j import neo4j_connection
    from app.db.session import async_session_factory
    from app.models.crystallization import CrystallizationJob
    from app.models.dataset import Dataset
    from app.models.module import Module
    from app.services.ingestion.fsd_adapter import adapt

    # Step 1: Build the graph via FSD adapter
    logger.info("Step 1: Fetching FSD data and building graph")
    graph = await adapt()

    # Step 2: Serialize graph to JSON (for awakening pipeline)
    graph_json = json.dumps({
        "entities": [
            {"name": e.name, "type": e.entity_type, **e.attributes}
            for e in graph.entities
        ],
        "relationships": [
            {
                "source": r.source,
                "target": r.target,
                "type": r.relationship_type,
                "weight": r.weight,
            }
            for r in graph.relationships
        ],
    }).encode("utf-8")

    async with async_session_factory() as db:
        # Resolve system user first — needed for dataset owner_id
        from app.models.user import User
        admin_result = await db.execute(select(User).limit(1))
        admin_user = admin_result.scalar_one_or_none()
        system_user_id = admin_user.id if admin_user else uuid.UUID("ee53d11e-e90a-447c-a968-b11cb654af66")

        # Step 3: Find or create the FSD dataset
        result = await db.execute(
            select(Dataset).where(Dataset.name == FSD_DATASET_NAME)
        )
        dataset = result.scalar_one_or_none()

        if dataset is None:
            dataset = Dataset(
                name=FSD_DATASET_NAME,
                description=(
                    "Franklin Street Data — 605 Chapel Hill venues with multi-hour "
                    "busyness profiles, spatial proximity, and temporal correlation edges. "
                    "Auto-refreshed daily via BTUT Mean-Field Game engine."
                ),
                owner_id=system_user_id,
                status="uploading",
            )
            db.add(dataset)
            await db.flush()
            logger.info("Created FSD dataset: %s", dataset.id)
        else:
            dataset.status = "uploading"
            await db.flush()
            logger.info("Reusing FSD dataset: %s", dataset.id)

        dataset_id = dataset.id

        # Step 4: Run awakening pipeline (normalize → validate → profile → Neo4j)
        logger.info("Step 4: Running awakening pipeline")
        from app.services.ingestion.awakening_pipeline import AwakeningPipeline

        pipeline = AwakeningPipeline(db=db, neo4j=neo4j_connection, minio_client=None)
        awakening_result = await pipeline.run(
            dataset_id=dataset_id,
            user_id=system_user_id,
            file_content=graph_json,
            file_name="fsd_multi_hour.json",
            content_type="json",
        )

        if awakening_result["status"] != "ready":
            raise RuntimeError(
                f"Awakening pipeline failed: {awakening_result.get('status')}"
            )

        logger.info(
            "Awakening complete: %d entities, %d edges",
            awakening_result["entity_count"],
            awakening_result["relationship_count"],
        )

        # Step 5: Trigger crystallization
        logger.info("Step 5: Triggering crystallization")
        job = CrystallizationJob(
            dataset_id=dataset_id,
            status="queued",
            config={},
            created_by=system_user_id,
        )
        db.add(job)
        await db.commit()

        job_id = str(job.id)

        # Dispatch crystallization task (will route to RunPod if configured)
        celery_app.send_task(
            "crystallization.run",
            args=[job_id],
            queue="crystallization",
        )

        # Step 6: Poll for completion (max 30 minutes)
        logger.info("Step 6: Waiting for crystallization job=%s", job_id)
        max_wait = settings.RUNPOD_MAX_JOB_SECONDS
        poll_interval = 10
        elapsed = 0

        while elapsed < max_wait:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            result = await db.execute(
                select(CrystallizationJob).where(
                    CrystallizationJob.id == uuid.UUID(job_id)
                )
            )
            current_job = result.scalar_one()
            await db.refresh(current_job)

            if current_job.status == "completed":
                logger.info("Crystallization completed in %ds", elapsed)
                break
            elif current_job.status == "failed":
                raise RuntimeError(
                    f"Crystallization failed: {current_job.error_message}"
                )

        # Step 7: Collect module results
        modules_result = await db.execute(
            select(Module).where(Module.dataset_id == dataset_id)
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

        return {
            "dataset_id": str(dataset_id),
            "job_id": job_id,
            "module_count": len(modules),
            "modules": module_summaries,
            "entity_count": awakening_result["entity_count"],
            "edge_count": awakening_result["relationship_count"],
        }
