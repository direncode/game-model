"""Well — self-diagnosing data reservoir with health sensors."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List


class WellState(str, Enum):
    ACTIVE = "active"
    SATURATED = "saturated"
    STARVED = "starved"
    DORMANT = "dormant"


@dataclass
class HealthVector:
    """Normalized sensor readings for a well. All values clamped to [0, 1]."""
    saturation: float = 0.0
    conversion: float = 0.0
    impulse: float = 0.0
    staleness: float = 0.0

    def __post_init__(self):
        self.saturation = max(0.0, min(1.0, self.saturation))
        self.conversion = max(0.0, min(1.0, self.conversion))
        self.impulse = max(0.0, min(1.0, self.impulse))
        self.staleness = max(0.0, min(1.0, self.staleness))

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.saturation, self.conversion, self.impulse, self.staleness)

    def mean(self) -> float:
        vals = self.as_tuple()
        return sum(vals) / len(vals)


_SATURATED_THRESHOLD = 0.9
_STARVED_SAT_THRESHOLD = 0.05
_STARVED_IMPULSE_THRESHOLD = 0.05


def _derive_state(health: HealthVector) -> WellState:
    if health.saturation >= _SATURATED_THRESHOLD:
        return WellState.SATURATED
    if health.saturation <= _STARVED_SAT_THRESHOLD and health.impulse <= _STARVED_IMPULSE_THRESHOLD:
        return WellState.STARVED
    return WellState.ACTIVE


class Well:
    """A data reservoir that maintains sensor readings about its own state."""

    def __init__(self, well_id: str, label: str = ""):
        self.well_id = well_id
        self.label = label or well_id
        self.health = HealthVector()
        self.state = WellState.DORMANT
        self.health_history: List[HealthVector] = []

    def update_sensors(
        self,
        saturation: float,
        conversion: float,
        impulse: float,
        staleness: float,
    ) -> None:
        self.health = HealthVector(
            saturation=saturation,
            conversion=conversion,
            impulse=impulse,
            staleness=staleness,
        )
        self.state = _derive_state(self.health)
        self.health_history.append(self.health)
