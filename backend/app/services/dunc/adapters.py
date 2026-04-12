"""Tracking adapter interface.

Mirrors the same pattern as `app.services.ingestion.csv_adapter` and
`fsd_adapter`: a thin ABC plus a concrete implementation. Real GPS/RFID
vendor integrations (Catapult, STATSports, Zebra) will land as additional
subclasses — nothing in the rest of the dunc package needs to change.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Iterable, Literal

# ── Flat, unopinionated on-the-wire record ─────────────────────────────
#
# Every adapter yields these. The simulator's player emissions get reshaped
# into this exact structure, and any future vendor adapter does the same.
# The tactical engine and frontend never see vendor-specific payloads.


@dataclass
class TrackingSample:
    """One player observation at one instant.

    x, y are meters on a standard 105×68 pitch (home team attacks +x).
    """

    t: float  # seconds since kickoff
    player_id: str
    team: Literal["home", "away"]
    number: int
    role: str
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0


@dataclass
class BallSample:
    t: float
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0


@dataclass
class TrackingFrame:
    """All samples from a single tracking tick."""

    t: float
    ball: BallSample
    players: list[TrackingSample] = field(default_factory=list)


class TrackingAdapter(ABC):
    """Abstract tracking source.

    Implementations pull from a vendor API, a file, or a simulator and
    yield `TrackingFrame`s at whatever rate they run.
    """

    name: str = "abstract"
    hz: float = 10.0

    @abstractmethod
    def start(self) -> None:
        """Begin the underlying feed (connect, open file, spin up sim)."""

    @abstractmethod
    def stop(self) -> None:
        """Tear down the underlying feed."""

    @abstractmethod
    async def frames(self) -> AsyncIterator[TrackingFrame]:
        """Async iterator yielding tracking frames until `stop()`."""
        if False:  # pragma: no cover - satisfies async-generator type
            yield  # type: ignore[unreachable]


class SyntheticAdapter(TrackingAdapter):
    """Bridge between `MatchSimulator` and the `TrackingAdapter` interface.

    Importing the simulator lazily avoids a circular import at package init.
    The adapter is intentionally dumb: it just shovels frames from the sim
    into the common wire format.
    """

    name = "synthetic"

    def __init__(self, simulator=None, hz: float = 10.0) -> None:
        self.hz = hz
        self._sim = simulator  # MatchSimulator, injected to avoid cycles
        self._started = False

    def attach(self, simulator) -> None:
        self._sim = simulator

    def start(self) -> None:
        if self._sim is None:
            raise RuntimeError("SyntheticAdapter.start() with no simulator attached")
        self._sim.reset()
        self._started = True

    def stop(self) -> None:
        self._started = False

    async def frames(self) -> AsyncIterator[TrackingFrame]:  # type: ignore[override]
        import asyncio

        if self._sim is None:
            raise RuntimeError("SyntheticAdapter.frames() with no simulator attached")

        dt = 1.0 / max(self.hz, 1e-6)
        while self._started:
            frame = self._sim.step()
            yield frame
            await asyncio.sleep(dt)
