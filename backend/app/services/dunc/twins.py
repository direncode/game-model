"""Digital twins — derived per-player state computed from tracking frames.

A `DigitalTwin` is NOT the raw tracking sample; it is the *derived* state a
coach actually cares about: cumulative distance, current speed, acceleration,
a fatigue proxy, current zone, and so on. The registry owns one twin per
player and updates it incrementally as new frames arrive.

The tactical engine reads twins to run its detectors. The WebSocket serializer
reads twins to build the frame sent to the frontend. All derivation logic lives
here so those two consumers stay dumb.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable, Literal

from app.services.dunc.adapters import TrackingFrame, TrackingSample

PITCH_X = 105.0
PITCH_Y = 68.0


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _zone_for(x: float, y: float, team: Literal["home", "away"]) -> str:
    """Return a coarse tactical zone label in that player's attacking frame."""
    # Flip x for away team so "attacking third" always means the opponent's box.
    ax = x if team == "home" else PITCH_X - x
    if ax < PITCH_X / 3:
        third = "def"
    elif ax < 2 * PITCH_X / 3:
        third = "mid"
    else:
        third = "att"
    if y < PITCH_Y / 3:
        lane = "L"
    elif y < 2 * PITCH_Y / 3:
        lane = "C"
    else:
        lane = "R"
    return f"{third}-{lane}"


@dataclass
class DigitalTwin:
    """Derived live state for one player."""

    player_id: str
    team: Literal["home", "away"]
    number: int
    role: str

    # Live kinematics
    x: float = 0.0
    y: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    speed: float = 0.0         # m/s
    accel: float = 0.0         # m/s², low-pass filtered

    # Cumulative
    distance_m: float = 0.0
    high_intensity_m: float = 0.0    # distance run above 5.5 m/s
    sprint_count: int = 0            # discrete sprint starts (> 7 m/s)
    _was_sprinting: bool = False

    # Derived
    fatigue: float = 0.0       # 0..1 proxy combining distance + recent HI load
    zone: str = "mid-C"

    _last_t: float = 0.0
    _last_speed: float = 0.0

    def update(self, sample: TrackingSample) -> None:
        dt = max(sample.t - self._last_t, 1e-3)
        # Use the tracking sample's own velocity if provided, else difference.
        vx = sample.vx if sample.vx or sample.vy else (sample.x - self.x) / dt
        vy = sample.vy if sample.vx or sample.vy else (sample.y - self.y) / dt
        speed = math.hypot(vx, vy)

        # Distance (always from position delta so it matches pitch truth).
        step = math.hypot(sample.x - self.x, sample.y - self.y) if self._last_t > 0 else 0.0
        self.distance_m += step
        if speed > 5.5:
            self.high_intensity_m += step

        # Sprint counter (rising-edge above 7 m/s).
        if speed > 7.0 and not self._was_sprinting:
            self.sprint_count += 1
            self._was_sprinting = True
        elif speed < 5.5:
            self._was_sprinting = False

        # Low-passed acceleration magnitude.
        raw_accel = (speed - self._last_speed) / dt
        self.accel = 0.7 * self.accel + 0.3 * raw_accel

        self.x = sample.x
        self.y = sample.y
        self.vx = vx
        self.vy = vy
        self.speed = speed
        self.zone = _zone_for(self.x, self.y, self.team)

        # Fatigue proxy: normalized cumulative distance + recent HI weighting.
        # Linear to ~12km covered (elite match load) clamped to [0, 1].
        self.fatigue = _clamp(
            0.55 * (self.distance_m / 12000.0)
            + 0.45 * (self.high_intensity_m / 1200.0),
            0.0,
            1.0,
        )

        self._last_t = sample.t
        self._last_speed = speed


class DigitalTwinRegistry:
    """Holds one twin per player, keyed by `player_id`."""

    def __init__(self) -> None:
        self._twins: dict[str, DigitalTwin] = {}

    def ingest(self, frame: TrackingFrame) -> None:
        for sample in frame.players:
            twin = self._twins.get(sample.player_id)
            if twin is None:
                twin = DigitalTwin(
                    player_id=sample.player_id,
                    team=sample.team,
                    number=sample.number,
                    role=sample.role,
                    x=sample.x,
                    y=sample.y,
                )
                self._twins[sample.player_id] = twin
            twin.update(sample)

    def all(self) -> list[DigitalTwin]:
        return list(self._twins.values())

    def get(self, player_id: str) -> DigitalTwin | None:
        return self._twins.get(player_id)

    def team(self, team: Literal["home", "away"]) -> list[DigitalTwin]:
        return [t for t in self._twins.values() if t.team == team]
