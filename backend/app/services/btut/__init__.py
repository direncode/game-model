"""BTUT — Extreme Data Reduction Engine for Latent Ocean.

Forward-only Fokker-Planck mean-field game solver used as an 8-tier
hierarchical clustering and data reduction tuner. Achieves ~1,000,000x
reduction on petabyte-scale data while preserving signal-rich structures.

Public API:
    BTUTTuner  — Master orchestrator (async)
    BTUTConfig — Configuration with auto_scale()
    BTUTResult — Comprehensive output metrics

Usage:
    from app.services.btut import BTUTTuner, BTUTConfig

    config = BTUTConfig.auto_scale(entity_count=3_000_000, budget_dollars=50)
    tuner = BTUTTuner(config)
    result = await tuner.tune(entities, edges, job_id="abc")
    reduced_entities = result.survivors
    reduced_edges = result.survivor_edges
"""

from .config import BTUTConfig
from .magnitude import (
    MagnitudeTable, MagnitudeTag, MagnitudeFlasher,
    ClusterBounds, MagnitudeResult, MagnitudeParser,
)
from .metrics import BTUTResult
from .threading import LatticeThreader, ThreadingConfig, CohesiveFingerprinter
from .tuner import BTUTTuner

__all__ = [
    "BTUTTuner", "BTUTConfig", "BTUTResult",
    "LatticeThreader", "ThreadingConfig", "CohesiveFingerprinter",
    "MagnitudeTable", "MagnitudeTag", "MagnitudeFlasher",
    "ClusterBounds", "MagnitudeResult", "MagnitudeParser",
]
