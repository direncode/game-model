"""Celery task for BTUT dataset ingestion.

Runs the full BTUT pipeline asynchronously: fetch → pipeline → save results.
Triggered via POST /api/v1/btut/ingest?dataset=pubmed&limit=50000
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

# Result storage paths
RESULTS_DIR = Path("/app/data")  # Docker container path
RESULTS_DIR_LOCAL = Path(__file__).resolve().parents[3] / "scripts" / "results"


@celery_app.task(
    name="btut.ingest_dataset",
    queue="crystallization",
    bind=True,
    max_retries=1,
    soft_time_limit=3600,
    time_limit=3900,
)
def ingest_dataset_task(self, dataset_id: str, limit: int = 10000, target_survivors: int = 500):
    """Async BTUT ingestion task.

    Args:
        dataset_id: Dataset adapter ID (edgar, pubmed, patents, comtrade, climate)
        limit: Max entities to fetch
        target_survivors: Target survivor count
    """
    from app.services.btut.adapters import get_adapter
    from app.services.btut.pipeline import run_btut_pipeline

    task_id = self.request.id
    logger.info("BTUT ingest starting: dataset=%s limit=%d task=%s", dataset_id, limit, task_id)

    self.update_state(state="PROGRESS", meta={"step": "fetching", "dataset": dataset_id})

    # Fetch
    try:
        adapter = get_adapter(dataset_id)
        meta = adapter.get_meta()
    except ValueError as e:
        logger.error("Unknown dataset: %s", e)
        return {"status": "error", "message": str(e)}

    t0 = time.time()
    entities = adapter.fetch_entities(limit=limit)
    edges = adapter.fetch_edges(entities)
    fetch_time = time.time() - t0

    if len(entities) < 10:
        return {"status": "error", "message": f"Only {len(entities)} entities fetched"}

    logger.info("Fetched %d entities, %d edges in %.1fs", len(entities), len(edges), fetch_time)
    self.update_state(state="PROGRESS", meta={
        "step": "pipeline", "entities": len(entities), "edges": len(edges),
    })

    # Run pipeline
    unique_types = [t.name for t in meta.entity_types]
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=target_survivors,
        progress_callback=lambda msg: logger.info("BTUT: %s", msg),
    )

    # Save result
    for results_dir in [RESULTS_DIR, RESULTS_DIR_LOCAL]:
        try:
            results_dir.mkdir(parents=True, exist_ok=True)
            output_path = results_dir / f"{dataset_id}_superpower_result.json"
            with open(output_path, "w") as f:
                json.dump(result, f, indent=2)
            logger.info("Saved to %s", output_path)
        except (OSError, PermissionError):
            continue

    # Persist to PostgreSQL
    try:
        from datetime import datetime
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session
        from app.config import settings
        from app.models.btut import BTUTRun

        sync_url = settings.DATABASE_URL.replace("+asyncpg", "").replace("postgresql://", "postgresql+psycopg2://")
        engine = create_engine(sync_url)

        with Session(engine) as session:
            run = BTUTRun(
                dataset_id=dataset_id,
                status="completed",
                total_entities=result.get("summary", {}).get("total_entities", 0),
                total_clusters=result.get("summary", {}).get("clusters", 0),
                total_fingerprints=result.get("summary", {}).get("unique_48bit_fingerprints", 0),
                survivor_count=result.get("summary", {}).get("survivors", 0),
                reduction_ratio=result.get("summary", {}).get("reduction", 0),
                variance_preservation=result.get("summary", {}).get("reconstruction", {}).get("variance_preservation"),
                wall_seconds=result.get("summary", {}).get("wall_seconds"),
                summary=result.get("summary"),
                survivors=result.get("survivors"),
                triggered_by="celery",
                celery_task_id=task_id,
                completed_at=datetime.utcnow(),
            )
            session.add(run)
            session.commit()
            logger.info("Persisted BTUT run to PostgreSQL: dataset=%s id=%s", dataset_id, run.id)
    except Exception as e:
        logger.warning("Failed to persist to PostgreSQL: %s", e)

    # Clear cached query engine so next query loads fresh data
    try:
        from app.services.btut.query_engine import _engines
        _engines.pop(dataset_id, None)
    except Exception:
        pass

    summary = result.get("summary", {})
    return {
        "status": "completed",
        "dataset": dataset_id,
        "entities": summary.get("total_entities", 0),
        "clusters": summary.get("clusters", 0),
        "survivors": summary.get("survivors", 0),
        "reduction": summary.get("reduction", 0),
        "wall_seconds": summary.get("wall_seconds", 0),
        "fetch_seconds": round(fetch_time, 1),
    }
