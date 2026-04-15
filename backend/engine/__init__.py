"""Latent Ocean Engine — Structural intelligence infrastructure.

The engine is a standalone package with zero application dependencies.
It can be used directly or through the application layer (FastAPI + dashboard).

Usage:
    from engine import LatentOceanEngine, EngineConfig

    engine = LatentOceanEngine(EngineConfig(budget_dollars=50.0))
    result = engine.run(my_connector, limit=10_000)
    print(result.quality.reduction_ratio)
"""
__version__ = "0.1.0"

from .config import EngineConfig
from .core import LatentOceanEngine
from .types import (
    ReductionResult, ManifoldResult, MonitorResult, FullResult,
    IngestResult, BTUTRunResult, ManifoldCoords, Survivor,
    QualityMetrics, CausalLink,
)

__all__ = [
    "LatentOceanEngine", "EngineConfig",
    "ReductionResult", "ManifoldResult", "MonitorResult", "FullResult",
    "IngestResult", "BTUTRunResult", "ManifoldCoords", "Survivor",
    "QualityMetrics", "CausalLink",
]
