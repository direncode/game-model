"""Wire — directed connection between wells with liquidity and friction."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import List


class WireState(str, Enum):
    FLOWING = "flowing"
    THROTTLED = "throttled"
    BLOCKED = "blocked"
    DORMANT = "dormant"


@dataclass
class WireMetrics:
    throughput: float
    readiness: float
    error_rate: float
    retry_count: int
    backpressure: float
    liquidity: float
    friction: float


_THROTTLE_FRICTION_THRESHOLD = 0.15
_BLOCKED_READINESS_THRESHOLD = 0.1
_BLOCKED_ERROR_THRESHOLD = 0.5


def _compute_friction(error_rate: float, retry_count: int, backpressure: float) -> float:
    """Composite friction: weighted sum of error rate, normalized retries, and backpressure."""
    retry_norm = min(1.0, retry_count / 100.0)
    return 0.4 * error_rate + 0.3 * retry_norm + 0.3 * backpressure


def _derive_wire_state(throughput: float, readiness: float, friction: float) -> WireState:
    if readiness < _BLOCKED_READINESS_THRESHOLD and throughput < 1e-6:
        return WireState.BLOCKED
    if friction >= _THROTTLE_FRICTION_THRESHOLD:
        return WireState.THROTTLED
    if throughput > 0 or readiness > 0:
        return WireState.FLOWING
    return WireState.DORMANT


class Wire:
    """A directed connection between two wells."""

    def __init__(self, source: str, sink: str):
        self.source = source
        self.sink = sink
        self.liquidity: float = 0.0
        self.friction: float = 0.0
        self.state = WireState.DORMANT
        self.metrics_history: List[WireMetrics] = []

    def update_metrics(
        self,
        throughput: float,
        readiness: float,
        error_rate: float,
        retry_count: int,
        backpressure: float,
    ) -> None:
        self.liquidity = throughput * readiness
        self.friction = _compute_friction(error_rate, retry_count, backpressure)
        self.state = _derive_wire_state(throughput, readiness, self.friction)
        self.metrics_history.append(WireMetrics(
            throughput=throughput,
            readiness=readiness,
            error_rate=error_rate,
            retry_count=retry_count,
            backpressure=backpressure,
            liquidity=self.liquidity,
            friction=self.friction,
        ))
