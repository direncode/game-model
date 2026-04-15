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
    compute (cosine linking, manifold search, TCD-JEPA training) uses.
    ``coords_3d_s2`` is optional, for 3D UI display only.
    """

    coords_8d_unit: np.ndarray
    coords_3d_s2: np.ndarray | None
    projection_method: str


@dataclass
class Survivor:
    """A surviving entity with its scores + manifold coordinates attached.

    ``display_name`` is the human-friendly label resolved from the
    adapter's primary_field (e.g. ``ticker`` for EDGAR companies,
    ``title`` for PubMed papers). Falls back to ``entity["name"]`` if
    no primary_field is configured or the attribute is missing. Used
    for cross-source link display and UI presentation so you never
    see auto-generated ids like ``company_1013871``.
    """

    entity: dict
    cluster: int
    scores: dict
    fingerprint: str
    coord_8d: list[float]
    coord_3d: list[float] | None
    display_name: str = ""


@dataclass
class QualityMetrics:
    """Summary quality metrics reported after a full run.

    Notes on the individual metrics:

      * ``variance_ratio`` — ``var(survivors) / var(full_population)``
        in the 8D projection space. **Not** a preservation ratio: BTUT
        deliberately over-samples outliers, so values > 1.0 mean the
        survivor set has *more* variance than the input, which is the
        intended behavior of anomaly-weighted selection. A healthy run
        is roughly in [0.9, 1.5].

      * ``coverage_at_1_0`` — fraction of input points whose nearest
        survivor is within distance 1.0 in the 8D space. This is the
        honest "can I reconstruct the population from survivors"
        number. Closer to 1.0 = better coverage. From BTUT's summary.

      * ``reconstruction_median_nn`` — median nearest-neighbor distance
        from input to survivors in 8D space. Lower is better.

      * ``n_clusters`` / ``unique_fingerprints`` — BTUT's own internal
        diversity measures of the survivor set.

      * ``estimated_cost_usd`` — a real model in ``costs.py``, not a
        made-up coefficient. Breaks down into ``cost_breakdown``.
    """

    n_input: int
    n_survivors: int
    reduction_ratio: int
    variance_ratio: float
    coverage_at_1_0: float
    reconstruction_median_nn: float
    n_clusters: int
    unique_fingerprints: int
    wall_seconds: float
    estimated_cost_usd: float
    cost_breakdown: dict


@dataclass
class CausalLink:
    """A single link between a survivor in layer A and a survivor in layer B."""

    source_a: str
    source_b: str
    signal: Literal["foreign_key", "semantic_field", "url_hierarchy", "cosine"]
    strength: float


# ── Engine API result types ────────────────────────────────────────────


@dataclass
class ReductionResult:
    """Output of engine.reduce()."""
    summary: dict
    survivors: list[dict]
    embeddings_8d: "np.ndarray"
    wall_seconds: float
    embed_context: dict


@dataclass
class ManifoldResult:
    """Output of engine.represent()."""
    coords_8d_unit: "np.ndarray"
    coords_3d_s2: "np.ndarray | None"
    projection_method: str


@dataclass
class MonitorResult:
    """Output of engine.monitor()."""
    circulation_rate: float
    friction_index: float
    saturation_pressure: float
    resilience: float
    well_states: list[dict]
    wire_states: list[dict]
    alerts: list[dict]


@dataclass
class FullResult:
    """Output of engine.run() — complete pipeline result."""
    reduction: ReductionResult
    manifold: ManifoldResult
    survivors: list["Survivor"]
    quality: "QualityMetrics"
    monitor: "MonitorResult | None" = None
