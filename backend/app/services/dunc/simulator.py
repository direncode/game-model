"""Synthetic match simulator.

Generates 22 players + ball on a standard 105×68 pitch at a target Hz with
realistic-enough dynamics to exercise the full dunc pipeline end to end.
The goal is NOT football-grade physics; it is a deterministic, seedable
stream with enough structure that tactical detectors have something to
detect (formation, pressing triggers, under-runs, etc.).

Design notes:
- Deterministic given `seed` — critical for tests and reproducible demos.
- Formation is 4-3-3 for both teams. Role anchors are pitch-relative.
- Players drift around their anchor via a small harmonic oscillator plus
  a goal-seeking term toward the ball when it enters their zone.
- The ball follows scripted beats (kickoff → build-up → transition → …),
  but can be nudged into scenarios (`trigger("under_run")`) which perturb
  specific players for ~5 seconds.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Literal

from app.services.dunc.adapters import BallSample, TrackingFrame, TrackingSample

PITCH_X = 105.0
PITCH_Y = 68.0

# ── 4-3-3 anchor coordinates (home, attacking +x) ──────────────────────
#
# Tuples are (x, y). Home mirrors to away via (PITCH_X - x, PITCH_Y - y).
# Role labels follow conventional abbreviations. Numbers are shirt-like.
_HOME_4_3_3: list[tuple[str, int, float, float]] = [
    ("GK",  1,  5.0, 34.0),
    ("LB",  3, 20.0, 12.0),
    ("LCB", 4, 20.0, 26.0),
    ("RCB", 5, 20.0, 42.0),
    ("RB",  2, 20.0, 56.0),
    ("LCM", 8, 40.0, 22.0),
    ("CM",  6, 40.0, 34.0),
    ("RCM", 10, 40.0, 46.0),
    ("LW", 11, 62.0, 16.0),
    ("ST",  9, 65.0, 34.0),
    ("RW",  7, 62.0, 52.0),
]


@dataclass
class MatchPreset:
    """Parameters controlling how the simulator runs a match."""

    name: str = "demo"
    hz: float = 10.0
    seed: int = 1337
    duration_seconds: float = 5400.0  # 90 minutes


@dataclass
class _PlayerState:
    player_id: str
    team: Literal["home", "away"]
    number: int
    role: str
    anchor_x: float
    anchor_y: float
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0
    phase: float = 0.0
    perturb_until: float = 0.0
    perturb_dx: float = 0.0
    perturb_dy: float = 0.0
    # Temporary anchor shift — used by scenarios that must actually move
    # the player's rest position (pressing shift, formation change, …).
    # The shift is added to (anchor_x, anchor_y) while `perturb_until > t`.
    anchor_shift_x: float = 0.0
    anchor_shift_y: float = 0.0


@dataclass
class _BallState:
    x: float = PITCH_X / 2
    y: float = PITCH_Y / 2
    vx: float = 0.0
    vy: float = 0.0
    beat_until: float = 0.0
    target_x: float = PITCH_X / 2
    target_y: float = PITCH_Y / 2


class MatchSimulator:
    """Deterministic football match simulator."""

    def __init__(self, preset: MatchPreset | None = None) -> None:
        self.preset = preset or MatchPreset()
        self._rng = random.Random(self.preset.seed)
        self.t: float = 0.0
        self._dt: float = 1.0 / max(self.preset.hz, 1e-6)
        self.players: list[_PlayerState] = []
        self.ball: _BallState = _BallState()
        self._pending_scenarios: list[str] = []
        self._build_formation()

    # ── lifecycle ──────────────────────────────────────────────────────
    def reset(self) -> None:
        """Rewind to kickoff. Preserves preset/seed for determinism."""
        self._rng = random.Random(self.preset.seed)
        self.t = 0.0
        self.players = []
        self.ball = _BallState()
        self._pending_scenarios = []
        self._build_formation()

    def trigger(self, scenario: str) -> None:
        """Schedule a scripted scenario for the next step.

        Supported scenarios (v0):
            Legacy 3: `under_run`, `pressing_shift`, `convergence`
            Pressing library: `high_press`, `counter_press`, `trap_sideline`,
                `trap_corner`, `mid_block`, `low_block`, `man_mark`, `zonal`,
                `drop_deep`, `hold_line`, `step_up`
        """
        self._pending_scenarios.append(scenario)

    # ── one tick of simulation ─────────────────────────────────────────
    def step(self) -> TrackingFrame:
        """Advance one tick and return the current frame."""
        # Apply any pending scenarios before integrating.
        for scenario in self._pending_scenarios:
            self._apply_scenario(scenario)
        self._pending_scenarios.clear()

        self._advance_ball()
        for p in self.players:
            self._advance_player(p)

        self.t += self._dt

        samples = [
            TrackingSample(
                t=self.t,
                player_id=p.player_id,
                team=p.team,
                number=p.number,
                role=p.role,
                x=p.x,
                y=p.y,
                vx=p.vx,
                vy=p.vy,
            )
            for p in self.players
        ]
        return TrackingFrame(
            t=self.t,
            ball=BallSample(
                t=self.t,
                x=self.ball.x,
                y=self.ball.y,
                vx=self.ball.vx,
                vy=self.ball.vy,
            ),
            players=samples,
        )

    # ── internals ──────────────────────────────────────────────────────
    def _build_formation(self) -> None:
        for role, number, ax, ay in _HOME_4_3_3:
            self.players.append(
                _PlayerState(
                    player_id=f"H{number:02d}",
                    team="home",
                    number=number,
                    role=role,
                    anchor_x=ax,
                    anchor_y=ay,
                    x=ax + self._rng.uniform(-0.5, 0.5),
                    y=ay + self._rng.uniform(-0.5, 0.5),
                    phase=self._rng.uniform(0, math.tau),
                )
            )
            self.players.append(
                _PlayerState(
                    player_id=f"A{number:02d}",
                    team="away",
                    number=number,
                    role=role,
                    anchor_x=PITCH_X - ax,
                    anchor_y=PITCH_Y - ay,
                    x=PITCH_X - ax + self._rng.uniform(-0.5, 0.5),
                    y=PITCH_Y - ay + self._rng.uniform(-0.5, 0.5),
                    phase=self._rng.uniform(0, math.tau),
                )
            )

    def _advance_ball(self) -> None:
        # Pick a new beat target every 2–4 seconds.
        if self.t >= self.ball.beat_until:
            self.ball.beat_until = self.t + self._rng.uniform(2.0, 4.0)
            self.ball.target_x = self._rng.uniform(15.0, PITCH_X - 15.0)
            self.ball.target_y = self._rng.uniform(8.0, PITCH_Y - 8.0)

        # Move ball toward target with moderate speed + damping.
        dx = self.ball.target_x - self.ball.x
        dy = self.ball.target_y - self.ball.y
        dist = max(math.hypot(dx, dy), 1e-6)
        desired = min(dist / max(self.ball.beat_until - self.t, 1e-3), 18.0)
        self.ball.vx = 0.6 * self.ball.vx + 0.4 * (dx / dist) * desired
        self.ball.vy = 0.6 * self.ball.vy + 0.4 * (dy / dist) * desired
        self.ball.x = _clip(self.ball.x + self.ball.vx * self._dt, 0.0, PITCH_X)
        self.ball.y = _clip(self.ball.y + self.ball.vy * self._dt, 0.0, PITCH_Y)

    def _advance_player(self, p: _PlayerState) -> None:
        p.phase += self._dt * 0.6

        # Clear anchor shift once the perturbation window expires.
        if self.t >= p.perturb_until:
            p.anchor_shift_x = 0.0
            p.anchor_shift_y = 0.0

        effective_anchor_x = p.anchor_x + p.anchor_shift_x
        effective_anchor_y = p.anchor_y + p.anchor_shift_y
        anchor_dx = effective_anchor_x - p.x
        anchor_dy = effective_anchor_y - p.y

        ball_dx = self.ball.x - p.x
        ball_dy = self.ball.y - p.y
        ball_dist = math.hypot(ball_dx, ball_dy)

        # Goal-seek ball only if it is within the player's zone (~18m).
        seek_gain = 0.0
        if ball_dist < 18.0 and p.role not in ("GK",):
            seek_gain = 0.25 * (18.0 - ball_dist) / 18.0

        # Harmonic drift around anchor + ball pull + slight noise.
        ax = 1.5 * anchor_dx + seek_gain * ball_dx + math.sin(p.phase) * 0.4
        ay = 1.5 * anchor_dy + seek_gain * ball_dy + math.cos(p.phase) * 0.4

        if self.t < p.perturb_until:
            ax += p.perturb_dx
            ay += p.perturb_dy

        damping = 0.72
        p.vx = damping * p.vx + ax * self._dt * 1.6
        p.vy = damping * p.vy + ay * self._dt * 1.6

        # Cap player speed at ~9.5 m/s (sprinting).
        speed = math.hypot(p.vx, p.vy)
        if speed > 9.5:
            p.vx *= 9.5 / speed
            p.vy *= 9.5 / speed

        p.x = _clip(p.x + p.vx * self._dt, 0.5, PITCH_X - 0.5)
        p.y = _clip(p.y + p.vy * self._dt, 0.5, PITCH_Y - 0.5)

    def _apply_scenario(self, scenario: str) -> None:
        """Perturb the simulation to produce a recognizable tactical event."""
        if scenario == "under_run":
            # Home striker fails to make his run: freeze his forward drive
            # while midfielders keep pushing.
            for p in self.players:
                if p.team == "home" and p.role == "ST":
                    p.perturb_until = self.t + 4.0
                    p.perturb_dx = -3.0
                    p.perturb_dy = 0.0
        elif scenario == "pressing_shift":
            # Away team triggers a high press: shift their anchors ~25m toward
            # the home goal. This is a real positional move, not just a
            # velocity kick, so the players actually rest in the home half
            # until the perturbation window expires.
            for p in self.players:
                if p.team == "away" and p.role != "GK":
                    p.perturb_until = self.t + 6.0
                    p.anchor_shift_x = -25.0
                    p.anchor_shift_y = 0.0
        elif scenario == "convergence":
            # Three home midfielders collapse toward the ball carrier in a
            # tight triangle — a classic complex convergence moment.
            for p in self.players:
                if p.team == "home" and p.role in ("LCM", "CM", "RCM"):
                    p.perturb_until = self.t + 3.5
                    p.perturb_dx = (self.ball.x - p.x) * 0.15
                    p.perturb_dy = (self.ball.y - p.y) * 0.15
        elif scenario in ("high_press", "counter_press"):
            # Home pushes the entire outfield line forward into opponent half.
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 8.0
                    p.anchor_shift_x = +25.0
        elif scenario == "trap_sideline":
            # Home wide midfielders slide toward the near touchline to funnel
            # the opposition ball carrier outward.
            for p in self.players:
                if p.team == "home" and p.role in ("LCM", "LW", "LB"):
                    p.perturb_until = self.t + 6.0
                    p.anchor_shift_y = -8.0
        elif scenario == "trap_corner":
            # Everyone collapses toward the corner flag the ball is nearest to.
            corner_x = 100.0 if self.ball.x > 52.5 else 5.0
            corner_y = 63.0 if self.ball.y > 34.0 else 5.0
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 5.0
                    p.anchor_shift_x = (corner_x - p.anchor_x) * 0.45
                    p.anchor_shift_y = (corner_y - p.anchor_y) * 0.45
        elif scenario == "mid_block":
            # Home outfielders settle in a compact mid-block around the halfway line.
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = (45.0 - p.anchor_x) * 0.4
        elif scenario == "low_block":
            # Home defenders and mids drop very deep.
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = (20.0 - p.anchor_x) * 0.55
        elif scenario == "man_mark":
            # Each away player gets a matching home shadow — cheap trick: nudge
            # every home outfielder toward the nearest away player.
            away = [p for p in self.players if p.team == "away" and p.role != "GK"]
            for p in self.players:
                if p.team != "home" or p.role == "GK":
                    continue
                if not away:
                    continue
                closest = min(
                    away,
                    key=lambda a: (a.x - p.x) ** 2 + (a.y - p.y) ** 2,
                )
                p.perturb_until = self.t + 8.0
                p.anchor_shift_x = (closest.anchor_x - p.anchor_x) * 0.6
                p.anchor_shift_y = (closest.anchor_y - p.anchor_y) * 0.6
        elif scenario == "zonal":
            # Undo any anchor shifts and hold formation — defensive zonal reset.
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = 0.0
                    p.anchor_shift_y = 0.0
        elif scenario == "drop_deep":
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 8.0
                    p.anchor_shift_x = -10.0
        elif scenario == "hold_line":
            # Back line compresses to same x (coordinate across the backline).
            backline = [p for p in self.players if p.team == "home" and p.role in ("LB", "LCB", "RCB", "RB")]
            if backline:
                avg_x = sum(p.anchor_x for p in backline) / len(backline)
                for p in backline:
                    p.perturb_until = self.t + 12.0
                    p.anchor_shift_x = (avg_x - p.anchor_x)
        elif scenario == "step_up":
            # Back line +8m up the pitch.
            for p in self.players:
                if p.team == "home" and p.role in ("LB", "LCB", "RCB", "RB"):
                    p.perturb_until = self.t + 8.0
                    p.anchor_shift_x = +8.0


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
