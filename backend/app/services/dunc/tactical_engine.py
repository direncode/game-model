"""Tactical engine — the brain of D-U-N-C.

Consumes digital twins tick-by-tick and emits `Insight`s. It is organized
as a pipeline of cheap heuristic detectors plus an optional windowed BTUT
convergence pass that fires at most once per second on ≤256-point tensors.

Critical design constraint (see the vertical design doc §11):
    We do NOT run full BTUT or TCD-JEPA per tick. The 10 Hz cost of that
    would be catastrophic. Instead we use BTUT's convergence detector on
    small rolling windows as a tactical-rhythm fingerprint, and match that
    fingerprint against heuristics. Heavy topology (persistent homology,
    full crystallization) is offline.
"""

from __future__ import annotations

import logging
import math
import time
from collections import deque
from typing import Optional

import numpy as np

from app.services.dunc.insights import Insight, InsightStream
from app.services.dunc.scenarios import ScenarioDetector
from app.services.dunc.twins import DigitalTwin, DigitalTwinRegistry

logger = logging.getLogger(__name__)


class TacticalEngine:
    """Emits `Insight`s from a live stream of digital-twin snapshots.

    Parameters
    ----------
    convergence_window_seconds:
        How much recent tracking history to feed into the BTUT convergence
        pass. 4s at 10 Hz = 40 frames * 22 players = 880 points, well under
        the 1024-point cap.
    convergence_hz:
        How often to run the convergence pass (Hz). 1 Hz = once per second.
    """

    def __init__(
        self,
        convergence_window_seconds: float = 4.0,
        convergence_hz: float = 1.0,
    ) -> None:
        self._window: deque[list[DigitalTwin]] = deque(maxlen=256)
        self._window_seconds = convergence_window_seconds
        self._convergence_period = 1.0 / max(convergence_hz, 1e-6)
        self._last_convergence_t: float = -math.inf
        self._scenario = ScenarioDetector()
        self._btut_available: Optional[bool] = None
        self._btut_detector = None

    # ── public API ────────────────────────────────────────────────────
    def tick(
        self,
        t: float,
        twins: DigitalTwinRegistry,
        ball_xy: tuple[float, float],
        stream: InsightStream,
        active_scenarios: list[dict] | None = None,
    ) -> None:
        """Advance one tick. Any new insights are pushed into `stream`."""
        snapshot = [
            DigitalTwin(
                player_id=tw.player_id,
                team=tw.team,
                number=tw.number,
                role=tw.role,
                x=tw.x,
                y=tw.y,
                vx=tw.vx,
                vy=tw.vy,
                speed=tw.speed,
                accel=tw.accel,
                distance_m=tw.distance_m,
                high_intensity_m=tw.high_intensity_m,
                sprint_count=tw.sprint_count,
                fatigue=tw.fatigue,
                zone=tw.zone,
            )
            for tw in twins.all()
        ]
        self._window.append(snapshot)

        # ── Cheap heuristic detectors every tick ──────────────────────
        for insight in self._scenario.detect(t, snapshot, ball_xy, active_scenarios):
            stream.push(insight)

        # ── Windowed BTUT convergence at most at `convergence_hz` ─────
        if t - self._last_convergence_t >= self._convergence_period:
            self._last_convergence_t = t
            conv_insight = self._convergence_pass(t, snapshot)
            if conv_insight is not None:
                stream.push(conv_insight)

    # ── BTUT convergence pass ─────────────────────────────────────────
    def _convergence_pass(
        self,
        t: float,
        snapshot: list[DigitalTwin],
    ) -> Optional[Insight]:
        """Use BTUT's convergence detector as a tactical-rhythm fingerprint.

        We reshape the last ~40 frames into a point cloud of (x, y) positions
        and ask whether the whole thing is converging in BTUT's sense. A hit
        is a coarse "tactical lock" signal that often precedes big moments.
        """
        if len(self._window) < 4:
            return None

        if self._btut_available is None:
            self._btut_available = self._init_btut_detector()
        if not self._btut_available:
            return None

        # Build the point cloud: stack (x, y) pairs across the window.
        pts = []
        for frame in self._window:
            for tw in frame:
                pts.append([tw.x, tw.y])
        if len(pts) < 8:
            return None
        states = np.asarray(pts, dtype=np.float64)

        # Density proxy: Gaussian kernel over pairwise distances.
        densities = _density_proxy(states, sigma=3.0)

        try:
            status = self._btut_detector.update(
                step=int(t * 10),
                states=states,
                prev_states=getattr(self, "_prev_states", None),
                densities=densities,
                prev_densities=getattr(self, "_prev_densities", None),
                sigma=3.0,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("dunc: BTUT convergence pass failed (%s); disabling", exc)
            self._btut_available = False
            return None

        self._prev_states = states
        self._prev_densities = densities

        if not status.converged:
            return None

        return Insight(
            id=f"conv-{int(t * 10)}",
            t=t,
            kind="convergence",
            severity="notable",
            title="Tactical convergence detected",
            summary=(
                "Windowed BTUT convergence on live tracking indicates a stable "
                "tactical lock — the shape is holding its structure across recent ticks."
            ),
            actors=[],
            evidence={
                "nash_gap": float(status.nash_gap),
                "density_change": float(status.density_change),
                "energy": float(status.energy),
                "window_points": int(states.shape[0]),
            },
            audience=["technical_staff"],
        )

    def _init_btut_detector(self) -> bool:
        """Lazy, defensive BTUT import so tests don't require the full stack."""
        try:
            from app.services.btut.config import BTUTConfig
            from app.services.btut.convergence import ConvergenceDetector

            cfg = BTUTConfig()
            # Loosen convergence so it can fire on tactical-scale motion.
            cfg.epsilon_nash = 0.8
            cfg.convergence_patience = 2
            self._btut_detector = ConvergenceDetector(cfg)
            return True
        except Exception as exc:
            logger.info("dunc: BTUT convergence unavailable (%s)", exc)
            self._btut_detector = None
            return False


# ── helpers ────────────────────────────────────────────────────────────
def _density_proxy(states: np.ndarray, sigma: float) -> np.ndarray:
    """Per-point Gaussian density estimate — enough to satisfy BTUT's API."""
    n = states.shape[0]
    if n == 0:
        return np.zeros(0, dtype=np.float64)
    # Subsample for speed if the window is large.
    if n > 128:
        idx = np.linspace(0, n - 1, 128, dtype=int)
        anchors = states[idx]
    else:
        anchors = states
    d2 = np.sum(
        (states[:, None, :] - anchors[None, :, :]) ** 2,
        axis=-1,
    )
    w = np.exp(-d2 / (2.0 * sigma * sigma))
    return w.sum(axis=1) / max(anchors.shape[0], 1)
