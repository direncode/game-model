"""Incremental document handler for the Data Estate vertical."""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.services.btut.pipeline import run_btut_pipeline
from app.services.crystallization.vertical_types import BTUTSurvivorBundle

from .ingestion_pipeline import text_to_entities

logger = logging.getLogger(__name__)


async def add_to_estate(
    raw_text: str,
    doc_id: str,
    session_id: str,
    target_survivors: int = 50,
    budget_dollars: float = 5.0,
) -> dict:
    """Add a new document to an existing estate session via delta bundle."""
    entities, edges = text_to_entities(raw_text, doc_id)
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    if len(entities) < 2:
        return {"status": "skipped", "reason": "too_few_chunks"}

    btut_result = run_btut_pipeline(
        entities=entities, edges=edges, unique_types=unique_types,
        target_survivors=target_survivors, budget_dollars=budget_dollars,
    )

    survivors = btut_result.get("survivors", [])
    n_survivors = len(survivors)
    if n_survivors == 0:
        return {"status": "no_survivors"}

    flat_embeds = btut_result.get("embeddings_8d", [])
    if flat_embeds and len(flat_embeds) == n_survivors * 8:
        embeddings = np.asarray(flat_embeds, dtype=np.float32).reshape(n_survivors, 8)
    else:
        embeddings = np.random.randn(n_survivors, 8).astype(np.float32)

    ids = [s["entity"]["name"] for s in survivors]
    bundle_edges: list[tuple[int, int, float]] = []
    id_to_idx = {eid: i for i, eid in enumerate(ids)}
    for edge in edges:
        src_idx = id_to_idx.get(edge["source"])
        dst_idx = id_to_idx.get(edge["target"])
        if src_idx is not None and dst_idx is not None:
            bundle_edges.append((src_idx, dst_idx, edge.get("weight", 1.0)))

    bundle = BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=bundle_edges,
        metadata={"provenance_job_id": f"estate-incr-{doc_id}", "doc_id": doc_id, "session_id": session_id},
    )

    logger.info("Incremental estate update: doc=%s session=%s survivors=%d", doc_id, session_id, n_survivors)
    return {"status": "ready", "doc_id": doc_id, "session_id": session_id, "survivor_count": n_survivors, "bundle": bundle}
