"""Celery task for async OceanOrchestrator.build_ocean() runs.

Triggered via POST /api/v1/data-layer/ocean/build-async. The REST endpoint
returns a job_id immediately; the client polls GET /data-layer/job/{id}.

Follows the data_layer_run.py pattern: sync task, self.update_state() for
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
    name="data_layer.ocean_build",
    queue="crystallization",
    bind=True,
    max_retries=1,
    soft_time_limit=7200,
    time_limit=7500,
)
def ocean_build_task(
    self,
    sources: list[str] | None = None,
    limits: dict | None = None,
    default_limit: int = 500,
    target_survivors: int = 100,
    budget_dollars: float = 5.0,
    cosine_threshold: float = 0.75,
) -> dict:
    """Async ocean build: multi-source ingest, BTUT, manifold, cross-linking."""
    from app.services.data_layer.orchestrator import OceanOrchestrator

    task_id = self.request.id
    logger.info(
        "data_layer.ocean_build starting: sources=%s default_limit=%d "
        "survivors=%d task=%s",
        sources, default_limit, target_survivors, task_id,
    )

    def _progress(msg: str) -> None:
        logger.info(msg)
        self.update_state(state="PROGRESS", meta={"message": msg})

    orch = OceanOrchestrator(
        default_limit=default_limit,
        target_survivors=target_survivors,
        budget_dollars=budget_dollars,
        cosine_threshold=cosine_threshold,
        log_callback=_progress,
    )

    t0 = time.time()
    try:
        manifest = orch.build_ocean(sources=sources, limits=limits)
    except Exception as e:
        logger.error("data_layer.ocean_build failed: %s", e)
        return {"status": "error", "message": str(e)}

    wall = time.time() - t0

    # Convert OceanManifest to a plain serializable dict.
    source_summaries = []
    for s in manifest.sources:
        source_summaries.append({
            "source_id": s.source_id,
            "n_input": s.n_input,
            "n_survivors": s.n_survivors,
            "reduction_ratio": s.reduction_ratio,
            "coverage_at_1_0": float(s.coverage_at_1_0),
            "variance_ratio": float(s.variance_ratio),
            "wall_seconds": float(s.wall_seconds),
            "cost_usd": float(s.cost_usd),
        })

    survivors_out = []
    for sv in manifest.survivors:
        survivors_out.append({
            "name": sv.name,
            "type": sv.type,
            "source_id": sv.source_id,
            "display_name": sv.display_name,
            "cluster": int(sv.cluster),
            "composite_score": float(sv.composite_score),
            "coord_3d": [float(c) for c in sv.coord_3d] if sv.coord_3d is not None else None,
        })

    cross_links_out = []
    for cl in manifest.cross_links:
        cross_links_out.append({
            "source_a": cl.source_a,
            "source_b": cl.source_b,
            "n_links": int(cl.n_links),
            "links_by_signal": {k: int(v) for k, v in cl.links_by_signal.items()},
        })

    link_matrix = {
        k: {kk: int(vv) for kk, vv in v.items()}
        for k, v in manifest.link_matrix.items()
    }

    benchmark = [
        {bk: (float(bv) if isinstance(bv, (int, float)) else str(bv)) for bk, bv in entry.items()}
        for entry in manifest.benchmark
    ]

    result = {
        "status": "completed",
        "sources": [s["source_id"] for s in source_summaries],
        "total_survivors": len(survivors_out),
        "total_links": sum(cl["n_links"] for cl in cross_links_out),
        "total_cost": float(manifest.total_cost_usd),
        "total_wall_seconds": round(wall, 1),
        "benchmark": benchmark,
        "link_matrix": link_matrix,
        "per_source_summary": source_summaries,
    }

    # Save result to disk.
    try:
        RESULTS_DIR_LOCAL.mkdir(parents=True, exist_ok=True)
        tag = f"ocean_build_{int(time.time())}"
        out_path = RESULTS_DIR_LOCAL / f"{tag}.json"
        out_path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
        logger.info("Saved result to %s", out_path)
    except (OSError, PermissionError) as e:
        logger.warning("Failed to save to disk: %s", e)

    return result
