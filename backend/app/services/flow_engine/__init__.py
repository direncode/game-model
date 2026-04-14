# backend/app/services/flow_engine/__init__.py
"""Flow Engine — universal data flow primitives for Latent Ocean.

Core abstractions:
  Well     — self-diagnosing data reservoir with health sensors
  Wire     — directed connection with liquidity and friction
  FlowGraph — directed graph computing system-level metrics

Meta-patterns (extracted from NIV):
  AlertEnvelope / alert_from_metric — hysteresis state machine
  ConformalPredictor               — uncertainty bands
  EnsembleAggregator              — disagreement detection
  walk_forward                     — expanding-window validation
"""

from .well import Well, WellState, HealthVector
from .wire import Wire, WireState
from .graph import FlowGraph
from .alerts import AlertLevel, AlertEnvelope, AlertThresholds, alert_from_metric
from .conformal import ConformalPredictor
from .ensemble import EnsembleAggregator, EnsembleResult
from .walkforward import WalkForwardConfig, WalkForwardResult, walk_forward

__all__ = [
    "Well", "WellState", "HealthVector",
    "Wire", "WireState",
    "FlowGraph",
    "AlertLevel", "AlertEnvelope", "AlertThresholds", "alert_from_metric",
    "ConformalPredictor",
    "EnsembleAggregator", "EnsembleResult",
    "WalkForwardConfig", "WalkForwardResult", "walk_forward",
]
