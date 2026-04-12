"""Bridge between LatentOceanDataLayer and NIV (finance vertical).

No NIV vertical code exists yet (it's next in the roadmap). This module
provides:

  1. ``niv_payload_to_search_index`` — converts the NIV export payload
     into a flat list of searchable records, ready to bulk-insert into a
     cosine-similarity search index (Qdrant, pgvector, or in-memory).

  2. ``find_nearest_survivors`` — brute-force nearest-neighbor search
     against a cached set of NIV survivors. Intended for the NIV query
     engine's "which survivors cluster near this new signal?" feature.

  3. ``data_layer_to_niv_index`` — convenience one-shot that runs the
     pipeline and returns a search-ready index.

When the NIV vertical is implemented, it should consume this bridge
module rather than importing from ``data_layer.core`` directly, so
the coupling point is localized and testable.
"""
from __future__ import annotations

import logging

import numpy as np

from . import LatentOceanDataLayer

logger = logging.getLogger(__name__)


def niv_payload_to_search_index(
    niv_payload: dict,
) -> list[dict]:
    """Convert an NIV export payload into flat searchable records.

    Each record has:
        - ``id``: entity name
        - ``vector``: 8D unit-sphere coords (list[float])
        - ``entity``: full entity dict (for display / drill-down)
        - ``scores``: BTUT composite + component scores
        - ``cluster``: BTUT cluster assignment

    This shape is compatible with Qdrant point upsert, pgvector row
    insert, or an in-memory numpy index.
    """
    records = []
    for s in niv_payload.get("survivors", []):
        records.append({
            "id": s["entity"].get("name", ""),
            "vector": s["coord_8d"],
            "entity": s["entity"],
            "scores": s["scores"],
            "cluster": s["cluster"],
        })
    return records


def find_nearest_survivors(
    query_vector: list[float] | np.ndarray,
    index_records: list[dict],
    top_k: int = 10,
) -> list[dict]:
    """Brute-force cosine NN search against an in-memory index.

    Args:
        query_vector: 8D vector (will be L2-normalized).
        index_records: Output of ``niv_payload_to_search_index``.
        top_k: Number of nearest survivors to return.

    Returns:
        Top-K records with an added ``similarity`` field, sorted desc.
    """
    q = np.asarray(query_vector, dtype=np.float32)
    q_norm = q / (np.linalg.norm(q) + 1e-10)

    if not index_records:
        return []

    vecs = np.array([r["vector"] for r in index_records], dtype=np.float32)
    sims = vecs @ q_norm  # cosine = dot product when unit-norm
    top_idx = np.argsort(-sims)[:top_k]

    results = []
    for i in top_idx:
        rec = dict(index_records[i])
        rec["similarity"] = float(sims[i])
        results.append(rec)
    return results


def data_layer_to_niv_index(
    source: str,
    *,
    limit: int = 10_000,
    target_survivors: int = 300,
    budget_dollars: float = 50.0,
) -> list[dict]:
    """One-shot: run the data layer pipeline and return a search-ready
    index of NIV survivors.

    Usage:
        index = data_layer_to_niv_index("edgar", limit=5000)
        hits = find_nearest_survivors(my_query_vector, index, top_k=5)
    """
    layer = LatentOceanDataLayer(
        budget_dollars=budget_dollars,
        target_survivors=target_survivors,
        compute_3d_display=False,
    )
    layer.ingest(source, limit=limit)
    layer.apply_btut_tuner()
    layer.project_to_manifold()
    payload = layer.export_for_vertical("niv")

    index = niv_payload_to_search_index(payload)
    logger.info(
        "data_layer → NIV index: %d records (source=%s)",
        len(index), source,
    )
    return index
