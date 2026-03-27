"""Celery task definitions for crystallization job management.

Defines the main crystallization task that orchestrates TCD-JEPA training,
result parsing, and downstream pipeline triggering.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import redis
from celery import states
from sqlalchemy import select, update

from app.celery_app import celery_app
from app.config import settings
from app.db.session import async_session_factory

logger = logging.getLogger(__name__)


def _get_redis() -> redis.Redis:
    """Create a synchronous Redis client for pub/sub progress updates."""
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def _publish_progress(dataset_id: str, data: dict) -> None:
    """Publish progress update via Redis pub/sub for WebSocket relay."""
    try:
        r = _get_redis()
        channel = f"crystallization:progress:{dataset_id}"
        r.publish(channel, json.dumps(data))
    except Exception:
        logger.warning("Failed to publish progress for dataset=%s", dataset_id)


@celery_app.task(
    bind=True,
    name="crystallization.run",
    queue="crystallization",
    max_retries=2,
    acks_late=True,
    reject_on_worker_lost=True,
    time_limit=14400,  # 4 hours hard limit
    soft_time_limit=13800,  # 3h50m soft limit
)
def run_crystallization_task(
    self, dataset_id: str, config: dict, job_id: str | None = None
) -> dict:
    """Main crystallization Celery task.

    Orchestrates:
    1. Job status update to 'running'.
    2. Config generation from dataset profile.
    3. Dataset export from Neo4j to TCD-JEPA format.
    4. TCD-JEPA training with progress publishing.
    5. Result parsing and module storage.
    6. Interpretation pipeline triggering.

    Args:
        dataset_id: UUID string of the dataset.
        config: Crystallization configuration overrides.
        job_id: UUID string of the job record (auto-generated if None).

    Returns:
        Dictionary with job results summary.
    """
    import asyncio

    job_id = job_id or str(uuid.uuid4())
    logger.info(
        "Crystallization task started: dataset=%s, job=%s",
        dataset_id,
        job_id,
    )

    try:
        # Run the async pipeline in a new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _run_crystallization_async(self, dataset_id, job_id, config)
            )
        finally:
            loop.close()

        return result

    except Exception as exc:
        logger.exception(
            "Crystallization task failed: dataset=%s, job=%s",
            dataset_id,
            job_id,
        )
        _publish_progress(dataset_id, {
            "job_id": job_id,
            "status": "failed",
            "error": str(exc),
        })

        # Retry on transient failures
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

        raise


async def _run_crystallization_async(
    task, dataset_id: str, job_id: str, config: dict
) -> dict:
    """Async implementation of the crystallization pipeline."""
    from app.services.crystallization.config_builder import ConfigBuilder
    from app.services.crystallization.results_parser import ResultsParser
    from app.services.crystallization.wrapper import TCDJEPAWrapper

    async with async_session_factory() as db:
        # Step 1: Update job status
        from app.models.crystallization import CrystallizationJob

        await db.execute(
            update(CrystallizationJob)
            .where(CrystallizationJob.id == uuid.UUID(job_id))
            .values(
                status="running",
                started_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

        _publish_progress(dataset_id, {
            "job_id": job_id,
            "status": "running",
            "step": "initializing",
        })

        # Step 2: Build config from dataset profile
        from app.models.dataset import Dataset

        result = await db.execute(
            select(Dataset).where(Dataset.id == uuid.UUID(dataset_id))
        )
        dataset = result.scalar_one()

        profile_data = {
            "entity_count": dataset.entity_count or 0,
            "edge_count": dataset.edge_count or 0,
            "density": dataset.density or 0.0,
        }

        builder = ConfigBuilder()
        from app.services.ingestion.profiler import DatasetProfile

        profile = DatasetProfile(
            entity_count=profile_data["entity_count"],
            edge_count=profile_data["edge_count"],
            density=profile_data["density"],
        )

        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            full_config = builder.build(profile, output_dir=tmpdir, overrides=config)
            config_path = f"{tmpdir}/tcd_jepa_config.yaml"

            # Step 3: Export dataset from Neo4j to file
            data_path = f"{tmpdir}/data"
            await _export_dataset_to_files(dataset_id, data_path)

            _publish_progress(dataset_id, {
                "job_id": job_id,
                "status": "running",
                "step": "training",
            })

            # Step 4: Run TCD-JEPA training
            def progress_callback(info: dict) -> None:
                _publish_progress(dataset_id, {
                    "job_id": job_id,
                    "status": "running",
                    "step": "training",
                    **info,
                })

            wrapper = TCDJEPAWrapper()
            training_result = await wrapper.run_training(
                config_path, data_path, callback=progress_callback
            )

        # Step 5: Parse results
        _publish_progress(dataset_id, {
            "job_id": job_id,
            "status": "running",
            "step": "parsing_results",
        })

        parser = ResultsParser()
        checkpoint_path = training_result.get("checkpoint_path", "")
        parsed = await parser.parse_training_output(training_result, checkpoint_path)

        # Step 6: Store results
        await _store_crystallization_results(
            db, dataset_id, job_id, parsed, training_result
        )

        _publish_progress(dataset_id, {
            "job_id": job_id,
            "status": "completed",
            "module_count": len(parsed.get("modules", [])),
        })

        # Step 7: Trigger interpretation pipeline
        _trigger_interpretation(dataset_id, job_id)

        logger.info(
            "Crystallization completed: dataset=%s, job=%s, modules=%d",
            dataset_id,
            job_id,
            len(parsed.get("modules", [])),
        )

        return {
            "job_id": job_id,
            "status": "completed",
            "module_count": len(parsed.get("modules", [])),
            "final_loss": training_result.get("final_loss"),
            "checkpoint_path": checkpoint_path,
        }


async def _export_dataset_to_files(dataset_id: str, data_path: str) -> None:
    """Export dataset from Neo4j to file format for TCD-JEPA."""
    import os

    from app.db.neo4j import neo4j_connection

    os.makedirs(data_path, exist_ok=True)

    dataset_label = dataset_id.replace("-", "_")

    # Export entities
    entities = await neo4j_connection.execute_query(
        f"""
        MATCH (n:Entity:`{dataset_label}`)
        RETURN n.name AS name, n.entity_type AS type, n.attributes AS attributes
        """,
    )

    with open(os.path.join(data_path, "entities.json"), "w") as f:
        json.dump(entities, f)

    # Export relationships
    edges = await neo4j_connection.execute_query(
        f"""
        MATCH (a:Entity:`{dataset_label}`)-[r:RELATES_TO]->(b:Entity:`{dataset_label}`)
        RETURN a.name AS source, b.name AS target, r.type AS type, r.weight AS weight
        """,
    )

    with open(os.path.join(data_path, "edges.json"), "w") as f:
        json.dump(edges, f)

    logger.info(
        "Exported %d entities, %d edges for dataset=%s",
        len(entities),
        len(edges),
        dataset_id,
    )


async def _store_crystallization_results(
    db, dataset_id: str, job_id: str, parsed: dict, training_result: dict
) -> None:
    """Store parsed crystallization results in PostgreSQL."""
    from app.models.crystallization import CrystallizationJob, TrainingMetric
    from app.models.module import Module, ModuleEntity

    # Update job record
    await db.execute(
        update(CrystallizationJob)
        .where(CrystallizationJob.id == uuid.UUID(job_id))
        .values(
            status="completed",
            completed_at=datetime.now(timezone.utc),
            final_link_auc=parsed.get("final_auc"),
            final_knn_accuracy=parsed.get("final_knn"),
            module_count=len(parsed.get("modules", [])),
            training_log=parsed.get("training_log"),
            checkpoint_path=training_result.get("checkpoint_path"),
        )
    )

    # Store training metrics
    for metric in parsed.get("metrics", []):
        db.add(TrainingMetric(
            job_id=uuid.UUID(job_id),
            epoch=metric["epoch"],
            step=metric["step"],
            loss=metric["loss"],
            link_auc=metric.get("auc"),
            knn_accuracy=metric.get("knn"),
            nan_detected=metric.get("nan_detected", False),
        ))

    # Store modules
    for mod in parsed.get("modules", []):
        module = Module(
            job_id=uuid.UUID(job_id),
            dataset_id=uuid.UUID(dataset_id),
            module_index=mod["module_index"],
            name=f"Module {mod['module_index']}",
            entity_count=mod.get("entity_count", 0),
            dominant_type=mod.get("dominant_type"),
            purity_score=mod.get("purity_score"),
            type_distribution=mod.get("type_distribution"),
            internal_density=mod.get("internal_density"),
        )
        db.add(module)
        await db.flush()

        for entity in mod.get("entities", []):
            db.add(ModuleEntity(
                module_id=module.id,
                entity_name=entity.get("name", ""),
                entity_type=entity.get("type", "unknown"),
                attributes=entity.get("attributes"),
            ))

    await db.commit()


def _trigger_interpretation(dataset_id: str, job_id: str) -> None:
    """Send task to the interpretation queue."""
    try:
        celery_app.send_task(
            "interpretation.run",
            args=[dataset_id, job_id],
            queue="interpretation",
        )
        logger.info(
            "Triggered interpretation pipeline: dataset=%s, job=%s",
            dataset_id,
            job_id,
        )
    except Exception:
        logger.exception("Failed to trigger interpretation pipeline")
