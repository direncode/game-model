"""Vertical export contracts for TCD-JEPA and the Data vertical.

Each exporter takes a state object (the ``LatentOceanDataLayer`` instance
itself, or any object with the same attribute shape) and returns a dict
in the handoff shape that particular vertical expects. Contracts are
intentionally small and explicit — verticals should need nothing else
to start consuming.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Callable

import numpy as np


def export_tcd_jepa(state: Any) -> dict:
    """TCD-JEPA (AI) vertical.

    Wants: flat embedding matrix + entity ids + type labels + cluster
    ids, optimized for batched training. Drops per-entity attributes
    to keep the payload compact.
    """
    if state.survivors:
        matrix = np.vstack(
            [np.asarray(s.coord_8d, dtype=np.float32) for s in state.survivors]
        )
    else:
        matrix = np.zeros((0, 8), dtype=np.float32)
    return {
        "vertical": "tcd_jepa",
        "dataset_id": state.ingest_result.source_id,
        "embeddings_8d": matrix.tolist(),
        "entity_ids": [s.entity.get("name", "") for s in state.survivors],
        "entity_types": [s.entity.get("type", "") for s in state.survivors],
        "clusters": [s.cluster for s in state.survivors],
    }


def export_data(state: Any) -> dict:
    """Data vertical (sell-through / audit).

    Wants: everything. Full ingest result, full BTUT summary, full
    survivors, both manifold coordinate systems, quality metrics.
    This is the largest payload of the three.
    """
    return {
        "vertical": "data",
        "dataset_id": state.ingest_result.source_id,
        "ingest": asdict(state.ingest_result),
        "btut_summary": state.btut_result.summary,
        "survivors": [asdict(s) for s in state.survivors],
        "manifold": {
            "coords_8d_unit": state.manifold.coords_8d_unit.tolist(),
            "coords_3d_s2": (
                state.manifold.coords_3d_s2.tolist()
                if state.manifold.coords_3d_s2 is not None
                else None
            ),
            "projection_method": state.manifold.projection_method,
        },
        "quality": asdict(state.quality_metrics),
    }


EXPORTERS: dict[str, Callable[[Any], dict]] = {
    "tcd_jepa": export_tcd_jepa,
    "data": export_data,
}
