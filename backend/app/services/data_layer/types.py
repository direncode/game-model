"""Dataclasses passed between stages of the data layer pipeline.

Each stage produces a typed result consumed by the next stage. Keeping
this shape explicit makes the facade easy to inspect and test, and makes
the handoff to downstream verticals unambiguous.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np


@dataclass
class IngestResult:
    """Output of ``LatentOceanDataLayer.ingest()``."""

    source_id: str
    entities: list[dict]
    edges: list[dict]
    unique_types: list[str]
    fetch_seconds: float


@dataclass
class BTUTRunResult:
    """Output of ``LatentOceanDataLayer.apply_btut_tuner()``.

    ``embeddings_8d`` is the reshaped (n_survivors, 8) matrix taken from
    ``btut.pipeline.run_btut_pipeline``'s flattened ``embeddings_8d``
    list. It is NOT L2-normalized yet — that happens in
    ``project_to_manifold``.
    """

    summary: dict
    survivors: list[dict]
    embeddings_8d: np.ndarray
    wall_seconds: float


@dataclass
class ManifoldCoords:
    """Output of ``LatentOceanDataLayer.project_to_manifold()``.

    ``coords_8d_unit`` is always populated and is what downstream
    compute (cosine linking, NIV search, TCD-JEPA training) uses.
    ``coords_3d_s2`` is optional, for 3D UI display only.
    """

    coords_8d_unit: np.ndarray
    coords_3d_s2: np.ndarray | None
    projection_method: str


@dataclass
class Survivor:
    """A surviving entity with its scores + manifold coordinates attached."""

    entity: dict
    cluster: int
    scores: dict
    fingerprint: str
    coord_8d: list[float]
    coord_3d: list[float] | None


@dataclass
class QualityMetrics:
    """Summary quality metrics reported after a full run."""

    n_input: int
    n_survivors: int
    reduction_ratio: int
    variance_preservation: float
    wall_seconds: float
    estimated_cost_usd: float


@dataclass
class CausalLink:
    """A single link between a survivor in layer A and a survivor in layer B."""

    source_a: str
    source_b: str
    signal: Literal["foreign_key", "semantic_field", "url_hierarchy", "cosine"]
    strength: float
