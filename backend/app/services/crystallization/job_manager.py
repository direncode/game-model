"""Celery task definitions for crystallization job management.

Defines the main crystallization task that orchestrates TCD-JEPA training,
result parsing, and downstream pipeline triggering.

Supports two execution backends:
- RunPod Serverless (GPU) — used when RUNPOD_API_KEY is configured
- Local execution — fallback when no RunPod credentials
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

logger = logging.getLogger(__name__)


def _get_redis() -> redis.Redis:
    """Create a synchronous Redis client for pub/sub progress updates."""
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def _publish_progress(job_id: str, data: dict) -> None:
    """Publish progress update via Redis pub/sub for WebSocket relay."""
    try:
        r = _get_redis()
        channel = f"crystallization:{job_id}"
        r.publish(channel, json.dumps(data))
    except Exception:
        logger.warning("Failed to publish progress for job=%s", job_id)


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
    self, job_id: str, config: dict | None = None
) -> dict:
    """Main crystallization Celery task.

    Routes to RunPod GPU when configured, otherwise runs locally.
    """
    import asyncio

    config = config or {}
    logger.info("Crystallization task started: job=%s", job_id)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _run_crystallization_async(self, job_id, config)
            )
        finally:
            loop.close()

        return result

    except Exception as exc:
        logger.exception("Crystallization task failed: job=%s", job_id)
        _publish_progress(job_id, {
            "job_id": job_id,
            "status": "failed",
            "error": str(exc),
        })

        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

        raise


async def _run_crystallization_async(task, job_id: str, config: dict) -> dict:
    """Async implementation — routes to RunPod or local execution.

    Creates fresh DB and Neo4j resources inside this event loop to avoid
    'Future attached to a different loop' errors when called from a Celery worker.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from neo4j import AsyncGraphDatabase
    from app.services.crystallization.runpod_client import is_runpod_configured
    from app.models.crystallization import CrystallizationJob
    from app.models.dataset import Dataset

    # Create fresh resources bound to THIS event loop
    engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    neo4j_driver = AsyncGraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
    )

    try:
        async with session_factory() as db:
            # Step 1: Get job and dataset info
            job_result = await db.execute(
                select(CrystallizationJob).where(CrystallizationJob.id == uuid.UUID(job_id))
            )
            job = job_result.scalar_one_or_none()
            if not job:
                raise ValueError(f"Job {job_id} not found")

            dataset_id = str(job.dataset_id)

            # Merge job config with task config
            merged_config = {**(job.config or {}), **config}

            result = await db.execute(
                select(Dataset).where(Dataset.id == job.dataset_id)
            )
            dataset = result.scalar_one()

            # Step 2: Update job status to running
            await db.execute(
                update(CrystallizationJob)
                .where(CrystallizationJob.id == uuid.UUID(job_id))
                .values(status="running", started_at=datetime.now(timezone.utc))
            )
            await db.commit()

            _publish_progress(job_id, {
                "job_id": job_id,
                "status": "running",
                "step": "initializing",
            })

            try:
                # Step 3: Export dataset from Neo4j (pass fresh driver)
                entities, edges = await _export_dataset(dataset_id, neo4j_driver)

                _publish_progress(job_id, {
                    "job_id": job_id,
                    "status": "running",
                    "step": "training",
                    "total_epochs": merged_config.get("epochs", 100),
                })

                # Step 4: Run training (RunPod or local)
                if is_runpod_configured():
                    training_result = await _run_via_runpod(
                        entities, edges, merged_config, dataset_id, job_id
                    )
                else:
                    training_result = await _run_locally(
                        entities, edges, merged_config, dataset_id, job_id
                    )

                # Step 5: Store results
                await _store_results(db, dataset_id, job_id, training_result)

                _publish_progress(job_id, {
                    "job_id": job_id,
                    "status": "completed",
                    "module_count": len(training_result.get("modules", [])),
                })

                logger.info(
                    "Crystallization completed: job=%s, modules=%d",
                    job_id,
                    len(training_result.get("modules", [])),
                )

                return {
                    "job_id": job_id,
                    "status": "completed",
                    "module_count": len(training_result.get("modules", [])),
                }

            except Exception as exc:
                # Mark job as failed in DB so fsd_crystallize polling detects it quickly
                logger.exception("Crystallization failed for job=%s", job_id)
                try:
                    await db.execute(
                        update(CrystallizationJob)
                        .where(CrystallizationJob.id == uuid.UUID(job_id))
                        .values(
                            status="failed",
                            completed_at=datetime.now(timezone.utc),
                            error_message=str(exc)[:1000],
                        )
                    )
                    await db.commit()
                except Exception:
                    logger.exception("Could not mark job as failed in DB: job=%s", job_id)
                raise

    finally:
        await neo4j_driver.close()
        await engine.dispose()


async def _run_via_runpod(
    entities: list, edges: list, config: dict,
    dataset_id: str, job_id: str,
) -> dict:
    """Run TCD-JEPA training via RunPod Serverless GPU."""
    from app.services.crystallization.runpod_client import RunPodClient

    client = RunPodClient()

    def on_progress(data: dict):
        """Forward RunPod streaming progress to Redis."""
        _publish_progress(job_id, {
            "job_id": job_id,
            "status": "running",
            "step": "training",
            **data,
        })

    result = await client.run_and_poll(
        entities=entities,
        edges=edges,
        config=config,
        dataset_id=dataset_id,
        job_id=job_id,
        progress_callback=on_progress,
        poll_interval=2.0,
        timeout=3600,
    )

    return result


async def _run_locally(
    entities: list, edges: list, config: dict,
    dataset_id: str, job_id: str,
) -> dict:
    """Run TCD-JEPA locally (CPU fallback)."""
    import tempfile

    from app.services.crystallization.config_builder import ConfigBuilder
    from app.services.crystallization.wrapper import TCDJEPAWrapper
    from app.services.ingestion.profiler import DatasetProfile

    profile = DatasetProfile(
        entity_count=len(entities),
        edge_count=len(edges),
        density=(2 * len(edges)) / max(len(entities) * (len(entities) - 1), 1),
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        builder = ConfigBuilder()
        builder.build(profile, output_dir=tmpdir, overrides=config)
        config_path = f"{tmpdir}/tcd_jepa_config.yaml"

        data_path = f"{tmpdir}/data"
        import os
        os.makedirs(data_path, exist_ok=True)

        with open(f"{data_path}/entities.json", "w") as f:
            json.dump(entities, f)
        with open(f"{data_path}/edges.json", "w") as f:
            json.dump(edges, f)

        def progress_callback(info: dict):
            _publish_progress(job_id, {
                "job_id": job_id,
                "status": "running",
                "step": "training",
                **info,
            })

        wrapper = TCDJEPAWrapper()
        training_result = await wrapper.run_training(
            config_path, data_path, callback=progress_callback
        )

    return training_result


async def _export_dataset(dataset_id: str, neo4j_driver=None) -> tuple[list, list]:
    """Export entities and edges from Neo4j for a dataset.

    Accepts an optional pre-created driver to avoid using the module-level
    singleton (which is uninitialized in Celery workers).
    """
    from app.db.neo4j import Neo4jConnection

    dataset_label = dataset_id.replace("-", "_")

    if neo4j_driver is not None:
        conn = Neo4jConnection()
        conn._driver = neo4j_driver
    else:
        # Fallback: create fresh driver bound to current event loop
        from neo4j import AsyncGraphDatabase
        fresh_driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        conn = Neo4jConnection()
        conn._driver = fresh_driver

    entities = await conn.execute_query(
        f"""
        MATCH (n:Entity:`{dataset_label}`)
        RETURN n.name AS name, n.entity_type AS type, n.attributes AS attributes
        """,
    )

    edges = await conn.execute_query(
        f"""
        MATCH (a:Entity:`{dataset_label}`)-[r:RELATES_TO]->(b:Entity:`{dataset_label}`)
        RETURN a.name AS source, b.name AS target, r.type AS type, r.weight AS weight
        """,
    )

    logger.info("Exported %d entities, %d edges for dataset=%s", len(entities), len(edges), dataset_id)
    return entities, edges


async def _store_results(db, dataset_id: str, job_id: str, result: dict) -> None:
    """Store crystallization results (modules + metrics) in PostgreSQL."""
    from app.models.crystallization import CrystallizationJob, TrainingMetric
    from app.models.module import Module, ModuleEntity

    # Delete any existing modules for this dataset (re-run)
    from sqlalchemy import delete
    await db.execute(
        delete(ModuleEntity).where(
            ModuleEntity.module_id.in_(
                select(Module.id).where(Module.dataset_id == uuid.UUID(dataset_id))
            )
        )
    )
    await db.execute(
        delete(Module).where(Module.dataset_id == uuid.UUID(dataset_id))
    )

    # Update job record
    await db.execute(
        update(CrystallizationJob)
        .where(CrystallizationJob.id == uuid.UUID(job_id))
        .values(
            status="completed",
            completed_at=datetime.now(timezone.utc),
            final_link_auc=result.get("final_auc"),
            final_knn_accuracy=result.get("final_knn"),
            module_count=len(result.get("modules", [])),
            training_log={
                "total_epochs": result.get("total_epochs"),
                "final_loss": result.get("final_loss"),
                "training_time_seconds": result.get("training_time_seconds"),
                "device": result.get("device"),
            },
        )
    )

    # Store training metrics
    for metric in result.get("training_metrics", result.get("metrics", [])):
        db.add(TrainingMetric(
            job_id=uuid.UUID(job_id),
            epoch=metric["epoch"],
            step=metric.get("step", metric["epoch"]),
            loss=metric["loss"],
            link_auc=metric.get("auc"),
            knn_accuracy=metric.get("knn"),
            nan_detected=metric.get("nan_detected", False),
        ))

    # Store modules
    for mod in result.get("modules", []):
        module = Module(
            job_id=uuid.UUID(job_id),
            dataset_id=uuid.UUID(dataset_id),
            module_index=mod["module_index"],
            name=mod.get("name", f"Module {mod['module_index']}"),
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
