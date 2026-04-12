"""Adapters from BTUT output shapes to BTUTSurvivorBundle.

BTUT emits in two shapes today:

1. `BTUTTuner.result` — a rich dataclass with .survivors, .survivor_edges,
   .quality_scores, .survivor_embeddings, .provenance_job_id.

2. `run_btut_pipeline()` dict — flat dict with 'survivors', 'embeddings_8d',
   'summary', 'embed_context'.

Both are normalized into a single BTUTSurvivorBundle here. The vertical
only ever sees the bundle; it never reaches into BTUT internals.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from .vertical_types import BTUTSurvivorBundle


def from_pipeline_dict(payload: dict[str, Any]) -> BTUTSurvivorBundle:
    """Convert a `run_btut_pipeline()` dict into a BTUTSurvivorBundle."""
    survivors = payload.get("survivors", [])
    flat = payload.get("embeddings_8d", [])
    if not flat:
        raise ValueError(
            "embeddings_8d is empty — BTUT pipeline did not emit a geometric lattice"
        )

    n = len(survivors)
    d = len(flat) // max(n, 1)
    if n * d != len(flat):
        raise ValueError(
            f"embeddings_8d length {len(flat)} not divisible by survivor count {n}"
        )

    embeddings = np.asarray(flat, dtype=np.float32).reshape(n, d)
    ids = [
        str(s.get("entity", {}).get("name", f"survivor_{i}"))
        for i, s in enumerate(survivors)
    ]
    cluster_assignments = [int(s.get("cluster", 0)) for s in survivors]

    # The pipeline dict doesn't carry an edge list — vertical will fall back
    # to a kNN graph inside crystallize() if edges is empty. That's fine.
    edges: list[tuple[int, int, float]] = []

    metadata: dict[str, Any] = {
        "cluster_assignments": cluster_assignments,
        "source": "btut_pipeline_dict",
    }
    summary = payload.get("summary", {})
    for key in ("variance_preservation", "wall_seconds", "coverages"):
        if key in summary:
            metadata[key] = summary[key]

    return BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=edges, metadata=metadata
    )


def from_tuner_result(result: Any) -> BTUTSurvivorBundle:
    """Convert a BTUTTuner.result (duck-typed) into a BTUTSurvivorBundle.

    Accepts any object with .survivors (list[dict]), .survivor_edges
    (list[tuple[str,str,float]]), .survivor_embeddings (np.ndarray),
    .quality_scores (dict), and .provenance_job_id (str|None).
    """
    survivors = list(result.survivors)
    ids = [str(s.get("name", f"survivor_{i}")) for i, s in enumerate(survivors)]

    # Edge list is name-based in BTUT; convert to index-based for the bundle.
    id_to_idx = {name: i for i, name in enumerate(ids)}
    edges: list[tuple[int, int, float]] = []
    for src, dst, weight in getattr(result, "survivor_edges", []):
        if src in id_to_idx and dst in id_to_idx:
            edges.append((id_to_idx[src], id_to_idx[dst], float(weight)))

    embeddings = np.asarray(
        getattr(result, "survivor_embeddings"), dtype=np.float32
    )

    metadata: dict[str, Any] = {
        "quality_scores": getattr(result, "quality_scores", {}),
        "provenance_job_id": getattr(result, "provenance_job_id", None),
        "source": "btut_tuner_result",
    }

    return BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=edges, metadata=metadata
    )
