"""Celery task for async LatentOceanDataLayer pipeline runs.

Triggered via POST /api/v1/data-layer/run-async. The REST endpoint
returns a job_id immediately; the client polls GET /data-layer/job/{id}.

Follows the btut_ingest.py pattern: sync task, self.update_state() for
progress, result JSON stored in Redis + local disk.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

RESULTS_DIR_LOCAL = Path(__file__).resolve().parents[3] / "scripts" / "results"


@celery_app.task(
    name="data_layer.run",
    queue="crystallization",
    bind=True,
    max_retries=1,
    soft_time_limit=3600,
    time_limit=3900,
)
def data_layer_run_task(
    self,
    source: str,
    limit: int = 10_000,
    target_survivors: int = 300,
    budget_dollars: float = 50.0,
    vertical: str | None = None,
    chunk_size: int | None = None,
) -> dict:
    """Async data layer run.

    If ``chunk_size`` is given, uses the two-pass cascade via
    ``run_chunked`` for memory-bounded processing of large inputs.
    Otherwise uses the standard ``run()``.
    """
    from app.services.data_layer import LatentOceanDataLayer

    task_id = self.request.id
    logger.info(
        "data_layer.run starting: source=%s limit=%d survivors=%d task=%s",
        source, limit, target_survivors, task_id,
    )

    def _progress(msg: str) -> None:
        logger.info(msg)
        self.update_state(state="PROGRESS", meta={"message": msg})

    layer = LatentOceanDataLayer(
        budget_dollars=budget_dollars,
        target_survivors=target_survivors,
        compute_3d_display=True,
        log_callback=_progress,
    )

    t0 = time.time()
    try:
        if chunk_size and limit > chunk_size:
            result = layer.run_chunked(
                source=source,
                limit=limit,
                chunk_size=chunk_size,
                vertical=vertical,
            )
        else:
            result = layer.run(
                source=source,
                vertical=vertical,
                limit=limit,
            )
    except Exception as e:
        logger.error("data_layer.run failed: %s", e)
        return {"status": "error", "message": str(e)}

    wall = time.time() - t0

    # Save result to disk.
    try:
        RESULTS_DIR_LOCAL.mkdir(parents=True, exist_ok=True)
        tag = f"{source}_{int(time.time())}"
        out_path = RESULTS_DIR_LOCAL / f"data_layer_{tag}.json"
        out_path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
        logger.info("Saved result to %s", out_path)
    except (OSError, PermissionError) as e:
        logger.warning("Failed to save to disk: %s", e)

    return {
        "status": "completed",
        "source": source,
        "wall_seconds": round(wall, 1),
        "result": result,
    }


@celery_app.task(
    name="data_layer.link",
    queue="crystallization",
    bind=True,
    max_retries=1,
    soft_time_limit=7200,
    time_limit=7500,
)
def data_layer_link_task(
    self,
    source_a: str,
    source_b: str,
    limit: int = 10_000,
    target_survivors: int = 300,
    budget_dollars: float = 50.0,
    cosine_threshold: float = 0.75,
) -> dict:
    """Async cross-source causal linking task."""
    from app.services.data_layer import LatentOceanDataLayer

    task_id = self.request.id
    logger.info(
        "data_layer.link starting: %s x %s limit=%d task=%s",
        source_a, source_b, limit, task_id,
    )

    def _progress(msg: str) -> None:
        logger.info(msg)
        self.update_state(state="PROGRESS", meta={"message": msg})

    layer_a = LatentOceanDataLayer(
        budget_dollars=budget_dollars,
        target_survivors=target_survivors,
        compute_3d_display=False,
        log_callback=_progress,
    )
    layer_b = LatentOceanDataLayer(
        budget_dollars=budget_dollars,
        target_survivors=target_survivors,
        compute_3d_display=False,
        log_callback=_progress,
    )

    try:
        layer_a.ingest(source_a, limit=limit)
        layer_a.apply_btut_tuner()
        layer_a.project_to_manifold()
        layer_b.ingest(source_b, limit=limit)
        layer_b.apply_btut_tuner()
        layer_b.project_to_manifold()
    except Exception as e:
        logger.error("data_layer.link failed during pipeline: %s", e)
        return {"status": "error", "message": str(e)}

    links = layer_a.link_causally(layer_b, threshold=cosine_threshold)
    by_signal: dict[str, int] = {}
    for lk in links:
        by_signal[lk.signal] = by_signal.get(lk.signal, 0) + 1

    top = sorted(links, key=lambda x: -x.strength)[:500]
    q_a = layer_a.get_quality_metrics()
    q_b = layer_b.get_quality_metrics()

    return {
        "status": "completed",
        "source_a": source_a,
        "source_b": source_b,
        "n_links": len(links),
        "links_by_signal": by_signal,
        "quality_a": {"n_input": q_a.n_input, "n_survivors": q_a.n_survivors, "reduction_ratio": q_a.reduction_ratio},
        "quality_b": {"n_input": q_b.n_input, "n_survivors": q_b.n_survivors, "reduction_ratio": q_b.reduction_ratio},
        "top_links": [
            {"source_a": lk.source_a, "source_b": lk.source_b, "signal": lk.signal, "strength": round(lk.strength, 4)}
            for lk in top
        ],
    }
