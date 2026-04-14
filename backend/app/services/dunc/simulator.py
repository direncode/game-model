"""Synthetic match simulator — Premier League intensity.

Every player runs at real speeds (walk 1.5m/s, jog 4m/s, run 7m/s, sprint
9.5m/s). The ball travels at real passing speed (ground pass 12-18m/s, long
ball 20-25m/s). Possession transfers trigger visible ball flight. Scenarios
produce immediate, dramatic formation shifts — not gradual drifts.

Architecture: each tick the engine (1) picks a play phase, (2) computes
a target position for every player from role+ball+phase, (3) moves each
player toward target at realistic speed, (4) handles passing and turnovers.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Literal

from app.services.dunc.adapters import BallSample, TrackingFrame, TrackingSample

PITCH_X = 105.0
PITCH_Y = 68.0

# Default 4-3-3 base positions (used when no PL preset is active)
_HOME_4_3_3: list[tuple[str, int, float, float]] = [
    ("GK",  1,  5.0, 34.0),
    ("LB",  3, 25.0, 10.0),
    ("LCB", 4, 22.0, 26.0),
    ("RCB", 5, 22.0, 42.0),
    ("RB",  2, 25.0, 58.0),
    ("LCM", 8, 42.0, 22.0),
    ("CM",  6, 40.0, 34.0),
    ("RCM", 10, 42.0, 46.0),
    ("LW", 11, 65.0, 12.0),
    ("ST",  9, 68.0, 34.0),
    ("RW",  7, 65.0, 56.0),
]


@dataclass
class MatchPreset:
    name: str = "demo"
    hz: float = 10.0
    seed: int = 1337
    duration_seconds: float = 5400.0
    pl_preset_key: str | None = None   # e.g. "ars_vs_mci"


@dataclass
class _PlayerState:
    player_id: str
    team: Literal["home", "away"]
    number: int
    role: str
    base_x: float
    base_y: float
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0
    target_x: float = 0.0
    target_y: float = 0.0
    phase_offset: float = 0.0
    has_ball: bool = False
    # Speed profile
    max_speed: float = 9.0       # sprint m/s
    jog_speed: float = 4.5       # jog m/s
    positioning_iq: float = 0.85
    # Scenario
    perturb_until: float = 0.0
    anchor_shift_x: float = 0.0
    anchor_shift_y: float = 0.0


@dataclass
class _BallState:
    x: float = PITCH_X / 2
    y: float = PITCH_Y / 2
    vx: float = 0.0
    vy: float = 0.0
    # Ball flight: when in_flight, ball travels at flight_speed to flight_target
    in_flight: bool = False
    flight_target_x: float = 0.0
    flight_target_y: float = 0.0
    flight_speed: float = 0.0
    carrier_id: str = ""
    carrier_team: Literal["home", "away"] = "home"


class MatchSimulator:
    def __init__(self, preset: MatchPreset | None = None) -> None:
        self.preset = preset or MatchPreset()
        self._rng = random.Random(self.preset.seed)
        self.t: float = 0.0
        self._dt: float = 1.0 / max(self.preset.hz, 1e-6)
        self.players: list[_PlayerState] = []
        self.ball: _BallState = _BallState()
        self._phase: float = 0.0
        self._next_pass_t: float = 0.0
        self._play_phase: str = "buildUp"
        self._pending_scenarios: list[str] = []
        self._active_scenario_map: dict[str, float] = {}
        self._pl_preset = None
        self._match_events: list[dict] = []
        self._home_score: int = 0
        self._away_score: int = 0
        self._home_xg: float = 0.0
        self._away_xg: float = 0.0
        self._next_event_t: float = self._rng.uniform(60, 300)
        self._load_pl_preset()
        self._build_formation()

    def reset(self) -> None:
        self._rng = random.Random(self.preset.seed)
        self.t = 0.0
        self.players = []
        self.ball = _BallState()
        self._phase = 0.0
        self._next_pass_t = 0.0
        self._play_phase = "buildUp"
        self._pending_scenarios = []
        self._active_scenario_map = {}
        self._match_events = []
        self._home_score = 0
        self._away_score = 0
        self._home_xg = 0.0
        self._away_xg = 0.0
        self._next_event_t = self._rng.uniform(60, 300)
        self._load_pl_preset()
        self._build_formation()

    def _load_pl_preset(self) -> None:
        if not self.preset.pl_preset_key:
            return
        try:
            from app.services.dunc.pl_presets import PL_PRESETS
            self._pl_preset = PL_PRESETS.get(self.preset.pl_preset_key)
        except Exception:
            self._pl_preset = None

    def get_match_info(self) -> dict:
        """Return match metadata for the frontend scoreboard."""
        if self._pl_preset:
            p = self._pl_preset
            return {
                "home_team": p.home_team,
                "away_team": p.away_team,
                "home_short": p.home_short,
                "away_short": p.away_short,
                "home_color": p.home_color,
                "away_color": p.away_color,
                "home_score": self._home_score,
                "away_score": self._away_score,
                "home_xg": round(self._home_xg, 2),
                "away_xg": round(self._away_xg, 2),
                "competition": p.competition,
                "matchday": p.matchday,
                "venue": p.venue,
                "home_manager": p.home_tactics.manager,
                "away_manager": p.away_tactics.manager,
                "context": p.context,
                "events": self._match_events[-10:],
            }
        return {
            "home_team": "Home",
            "away_team": "Away",
            "home_short": "HOM",
            "away_short": "AWY",
            "home_color": "#00d4ff",
            "away_color": "#c9a96e",
            "home_score": self._home_score,
            "away_score": self._away_score,
            "home_xg": round(self._home_xg, 2),
            "away_xg": round(self._away_xg, 2),
            "events": self._match_events[-10:],
        }

    def trigger(self, scenario: str) -> None:
        self._pending_scenarios.append(scenario)

    def get_active_scenarios(self) -> list[dict]:
        """Return currently active scenario perturbations with time remaining."""
        out = []
        for name, until in list(self._active_scenario_map.items()):
            remaining = until - self.t
            if remaining <= 0:
                del self._active_scenario_map[name]
                continue
            affected_ids = [
                p.player_id for p in self.players
                if p.perturb_until > self.t
                and (abs(p.anchor_shift_x) > 0.5 or abs(p.anchor_shift_y) > 0.5)
            ]
            out.append({
                "name": name,
                "remaining_sec": round(remaining, 1),
                "affected_count": len(affected_ids),
                "affected_ids": affected_ids,
            })
        return out

    def step(self) -> TrackingFrame:
        for s in self._pending_scenarios:
            self._apply_scenario(s)
        self._pending_scenarios.clear()

        self._phase += self._dt * 2.0
        self._update_play_phase()
        self._update_all_targets()
        self._move_all_players()
        self._update_ball()
        self._maybe_pass()
        self._maybe_match_event()

        self.t += self._dt

        samples = [
            TrackingSample(
                t=self.t, player_id=p.player_id, team=p.team,
                number=p.number, role=p.role,
                x=p.x, y=p.y, vx=p.vx, vy=p.vy,
            )
            for p in self.players
        ]
        return TrackingFrame(
            t=self.t,
            ball=BallSample(t=self.t, x=self.ball.x, y=self.ball.y,
                            vx=self.ball.vx, vy=self.ball.vy),
            players=samples,
        )

    # ── formation ──────────────────────────────────────────────────────
    def _build_formation(self) -> None:
        if self._pl_preset:
            self._build_pl_formation()
        else:
            self._build_default_formation()
        # Give ball to a home midfielder
        cm = next((p for p in self.players if p.team == "home" and p.role == "CM"), self.players[0])
        cm.has_ball = True
        self.ball.carrier_id = cm.player_id
        self.ball.carrier_team = "home"
        self.ball.x = cm.x
        self.ball.y = cm.y
        self._next_pass_t = self.t + self._rng.uniform(1.0, 2.5)

    def _build_default_formation(self) -> None:
        for role, number, bx, by in _HOME_4_3_3:
            self.players.append(_PlayerState(
                player_id=f"H{number:02d}", team="home", number=number, role=role,
                base_x=bx, base_y=by,
                x=bx + self._rng.uniform(-1, 1), y=by + self._rng.uniform(-1, 1),
                target_x=bx, target_y=by,
                phase_offset=self._rng.uniform(0, math.tau),
                max_speed=self._rng.uniform(8.5, 10.5),
                jog_speed=self._rng.uniform(3.8, 5.2),
                positioning_iq=self._rng.uniform(0.75, 0.98),
            ))
            self.players.append(_PlayerState(
                player_id=f"A{number:02d}", team="away", number=number, role=role,
                base_x=PITCH_X - bx, base_y=PITCH_Y - by,
                x=PITCH_X - bx + self._rng.uniform(-1, 1),
                y=PITCH_Y - by + self._rng.uniform(-1, 1),
                target_x=PITCH_X - bx, target_y=PITCH_Y - by,
                phase_offset=self._rng.uniform(0, math.tau),
                max_speed=self._rng.uniform(8.0, 10.0),
                jog_speed=self._rng.uniform(3.5, 5.0),
                positioning_iq=self._rng.uniform(0.70, 0.95),
            ))

    def _build_pl_formation(self) -> None:
        """Build formation from PL preset with real player attributes."""
        p = self._pl_preset
        for plp in p.home_squad:
            self.players.append(_PlayerState(
                player_id=f"H{plp.number:02d}", team="home", number=plp.number,
                role=plp.role, base_x=plp.base_x, base_y=plp.base_y,
                x=plp.base_x + self._rng.uniform(-1, 1),
                y=plp.base_y + self._rng.uniform(-1, 1),
                target_x=plp.base_x, target_y=plp.base_y,
                phase_offset=self._rng.uniform(0, math.tau),
                max_speed=plp.max_speed,
                jog_speed=plp.max_speed * 0.48,
                positioning_iq=plp.positioning_iq,
            ))
        for plp in p.away_squad:
            ax = PITCH_X - plp.base_x
            ay = PITCH_Y - plp.base_y
            self.players.append(_PlayerState(
                player_id=f"A{plp.number:02d}", team="away", number=plp.number,
                role=plp.role, base_x=ax, base_y=ay,
                x=ax + self._rng.uniform(-1, 1),
                y=ay + self._rng.uniform(-1, 1),
                target_x=ax, target_y=ay,
                phase_offset=self._rng.uniform(0, math.tau),
                max_speed=plp.max_speed,
                jog_speed=plp.max_speed * 0.48,
                positioning_iq=plp.positioning_iq,
            ))

    # ── play phase ─────────────────────────────────────────────────────
    def _update_play_phase(self) -> None:
        cycle = (self.t % 16.0) / 16.0
        if cycle < 0.30:
            self._play_phase = "buildUp"
        elif cycle < 0.50:
            self._play_phase = "progression"
        elif cycle < 0.70:
            self._play_phase = "finalThird"
        elif cycle < 0.82:
            self._play_phase = "pressing"
        else:
            self._play_phase = "transition"

    # ── target computation ─────────────────────────────────────────────
    def _update_all_targets(self) -> None:
        bx, by = self.ball.x, self.ball.y

        for p in self.players:
            if self.t >= p.perturb_until:
                p.anchor_shift_x *= 0.92  # decay shift smoothly
                p.anchor_shift_y *= 0.92
                if abs(p.anchor_shift_x) < 0.5:
                    p.anchor_shift_x = 0.0
                if abs(p.anchor_shift_y) < 0.5:
                    p.anchor_shift_y = 0.0

            eff_bx = p.base_x + p.anchor_shift_x
            eff_by = p.base_y + p.anchor_shift_y

            ph = self._phase + p.phase_offset
            iq = p.positioning_iq

            # Off-ball cycling — constant motion, amplitude varies by role
            amp = 4.0 + iq * 3.0
            cx = math.sin(ph) * amp
            cy = math.cos(ph * 0.7) * amp * 0.8

            if p.team == "home":
                self._target_home(p, bx, by, eff_bx, eff_by, cx, cy, iq)
            else:
                self._target_away(p, bx, by, eff_bx, eff_by, cx, cy, iq)

            # Ball carrier drives forward
            if p.has_ball:
                if p.team == "home":
                    p.target_x = min(90.0, p.x + 3.0)
                else:
                    p.target_x = max(15.0, p.x - 3.0)

    def _target_home(self, p, bx, by, base_x, base_y, cx, cy, iq):
        r = p.role
        predicted = bx + 6.0

        if r == "GK":
            p.target_x = 7.0 + (8.0 if self._play_phase == "buildUp" else 2.0)
            p.target_y = _clip(by * 0.15 + 31.0 + cy * 0.3, 24.0, 44.0)
        elif r == "LB":
            push = 22.0 if self._play_phase == "finalThird" else 10.0
            p.target_x = _clip(base_x + push + cx, 12.0, 70.0)
            p.target_y = _clip(base_y + cy, 2.0, 22.0)
        elif r in ("LCB", "RCB"):
            adv = iq * (14.0 if self._play_phase == "buildUp" else 5.0)
            p.target_x = _clip(base_x + adv + cx * 0.4, 12.0, 55.0)
            p.target_y = _clip(base_y + (by - 34.0) * 0.12 + cy * 0.5, 16.0, 52.0)
        elif r == "RB":
            if bx > 45.0 and iq > 0.82:
                p.target_x = _clip(bx - 5.0 + cx, 18.0, 62.0)
                p.target_y = _clip(58.0 + cy, 48.0, 66.0)
            else:
                p.target_x = _clip(base_x + (bx - 30.0) * 0.25 + cx, 14.0, 55.0)
                p.target_y = _clip(base_y + cy, 46.0, 66.0)
        elif r == "CM":
            p.target_x = _clip(predicted - 14.0 + cx * 0.4, 25.0, 65.0)
            p.target_y = _clip(34.0 + (by - 34.0) * 0.2 + cy * 0.4, 18.0, 50.0)
        elif r in ("LCM", "RCM"):
            is_right = "R" in r
            push = iq * (16.0 if self._play_phase == "finalThird" else 8.0)
            p.target_x = _clip(predicted + push + cx, 28.0, 82.0)
            p.target_y = _clip((48.0 if is_right else 20.0) + cy, 8.0, 60.0)
        elif r == "LW":
            p.target_x = _clip(bx + 16.0 * iq + cx, 35.0, 95.0)
            p.target_y = _clip(8.0 + cy, 2.0, 22.0)
        elif r == "RW":
            p.target_x = _clip(bx + 18.0 * iq + cx, 38.0, 98.0)
            p.target_y = _clip(60.0 + cy, 46.0, 66.0)
        elif r == "ST":
            p.target_x = _clip(max(58.0, predicted + 14.0) + cx * 0.5, 45.0, 98.0)
            p.target_y = _clip(34.0 + (by - 34.0) * 0.3 + cy * 0.6, 18.0, 50.0)

    def _target_away(self, p, bx, by, base_x, base_y, cx, cy, iq):
        r = p.role
        if r == "GK":
            p.target_x = _clip(98.0 - (8.0 if self._play_phase == "buildUp" else 2.0), 92.0, 104.0)
            p.target_y = _clip(by * 0.15 + 31.0 + cy * 0.3, 24.0, 44.0)
        elif r == "ST":
            p.target_x = _clip(bx - 14.0 + cx * 0.5, 7.0, 60.0)
            p.target_y = _clip(34.0 + (by - 34.0) * 0.3 + cy * 0.6, 18.0, 50.0)
        elif r in ("LW", "RW"):
            is_lw = r == "LW"
            p.target_x = _clip(bx - 16.0 * iq + cx, 7.0, 70.0)
            p.target_y = _clip((60.0 if is_lw else 8.0) + cy, 2.0, 66.0)
        elif r in ("LCM", "RCM", "CM"):
            block_x = bx + (6.0 if self._play_phase == "pressing" else 16.0)
            is_r = "R" in r or r == "CM"
            p.target_x = _clip(block_x + cx, 25.0, 85.0)
            p.target_y = _clip((42.0 if is_r else 26.0) + (by - 34.0) * 0.15 + cy, 10.0, 58.0)
        elif r in ("LCB", "RCB"):
            p.target_x = _clip(base_x + cx * 0.3, 62.0, 100.0)
            p.target_y = _clip(base_y + (by - 34.0) * 0.1 + cy * 0.4, 16.0, 52.0)
        elif r in ("LB", "RB"):
            p.target_x = _clip(base_x + cx, 55.0, 98.0)
            p.target_y = _clip(base_y + cy, 2.0, 66.0)

    # ── movement — actual velocity, not lerp ───────────────────────────
    def _move_all_players(self) -> None:
        dt = self._dt
        for p in self.players:
            dx = p.target_x - p.x
            dy = p.target_y - p.y
            dist = math.hypot(dx, dy)

            if dist < 0.2:
                # At target — micro-sway only
                p.x += self._rng.uniform(-0.15, 0.15)
                p.y += self._rng.uniform(-0.15, 0.15)
                p.vx = self._rng.uniform(-0.3, 0.3)
                p.vy = self._rng.uniform(-0.3, 0.3)
            else:
                # Choose speed based on distance to target
                if dist > 12.0:
                    speed = p.max_speed  # sprint
                elif dist > 5.0:
                    speed = p.max_speed * 0.75  # run
                elif dist > 2.0:
                    speed = p.jog_speed  # jog
                else:
                    speed = p.jog_speed * 0.6  # decel near target

                # Don't overshoot
                step = min(speed * dt, dist)
                nx = dx / dist
                ny = dy / dist

                old_x, old_y = p.x, p.y
                p.x += nx * step
                p.y += ny * step

                # Add small lateral wobble for realism
                perp_x = -ny * self._rng.uniform(-0.05, 0.05)
                perp_y = nx * self._rng.uniform(-0.05, 0.05)
                p.x += perp_x
                p.y += perp_y

                p.x = _clip(p.x, 0.5, PITCH_X - 0.5)
                p.y = _clip(p.y, 0.5, PITCH_Y - 0.5)
                p.vx = (p.x - old_x) / max(dt, 1e-6)
                p.vy = (p.y - old_y) / max(dt, 1e-6)

    # ── ball physics ───────────────────────────────────────────────────
    def _update_ball(self) -> None:
        dt = self._dt
        old_bx, old_by = self.ball.x, self.ball.y

        if self.ball.in_flight:
            # Ball flying to target at flight_speed
            dx = self.ball.flight_target_x - self.ball.x
            dy = self.ball.flight_target_y - self.ball.y
            dist = math.hypot(dx, dy)

            if dist < self.ball.flight_speed * dt * 1.5:
                # Arrived
                self.ball.x = self.ball.flight_target_x
                self.ball.y = self.ball.flight_target_y
                self.ball.in_flight = False
            else:
                step = self.ball.flight_speed * dt
                self.ball.x += (dx / dist) * step
                self.ball.y += (dy / dist) * step
        else:
            # Ball tracks carrier
            carrier = next((p for p in self.players if p.player_id == self.ball.carrier_id), None)
            if carrier is None:
                self._assign_nearest_carrier()
                carrier = next((p for p in self.players if p.player_id == self.ball.carrier_id), None)
            if carrier:
                # Tight follow — ball is at the player's feet
                self.ball.x += (carrier.x - self.ball.x) * 0.5
                self.ball.y += (carrier.y - self.ball.y) * 0.5

        self.ball.x = _clip(self.ball.x, 0.0, PITCH_X)
        self.ball.y = _clip(self.ball.y, 0.0, PITCH_Y)
        self.ball.vx = (self.ball.x - old_bx) / max(dt, 1e-6)
        self.ball.vy = (self.ball.y - old_by) / max(dt, 1e-6)

    def _assign_nearest_carrier(self) -> None:
        team_players = [p for p in self.players if p.team == self.ball.carrier_team and p.role != "GK"]
        if not team_players:
            team_players = [p for p in self.players if p.team == self.ball.carrier_team]
        if not team_players:
            return
        nearest = min(team_players, key=lambda p: (p.x - self.ball.x)**2 + (p.y - self.ball.y)**2)
        for p in self.players:
            p.has_ball = False
        nearest.has_ball = True
        self.ball.carrier_id = nearest.player_id

    # ── passing with real ball flight ──────────────────────────────────
    def _maybe_pass(self) -> None:
        if self.ball.in_flight:
            return
        if self.t < self._next_pass_t:
            return

        carrier = next((p for p in self.players if p.player_id == self.ball.carrier_id), None)
        if carrier is None:
            return

        teammates = [
            p for p in self.players
            if p.team == carrier.team and p.player_id != carrier.player_id and p.role != "GK"
        ]
        if not teammates:
            self._next_pass_t = self.t + 0.8
            return

        def weight(t):
            dist = math.hypot(t.x - carrier.x, t.y - carrier.y)
            if dist < 3.0 or dist > 50.0:
                return 0.01
            w = 10.0
            if dist < 15.0:
                w *= 3.5
            elif dist < 25.0:
                w *= 1.8
            else:
                w *= 0.5
            if carrier.team == "home" and t.x > carrier.x:
                w *= 1.5
            elif carrier.team == "away" and t.x < carrier.x:
                w *= 1.5
            w *= 0.5 + t.positioning_iq
            return w

        weights = [(t, weight(t)) for t in teammates]
        total = sum(w for _, w in weights)
        if total < 0.1:
            self._next_pass_t = self.t + 0.5
            return

        r = self._rng.random() * total
        target = teammates[0]
        for t, w in weights:
            r -= w
            if r <= 0:
                target = t
                break

        # Compute pass speed — short pass ~14 m/s, long ~22 m/s
        pass_dist = math.hypot(target.x - carrier.x, target.y - carrier.y)
        if pass_dist < 15.0:
            pass_speed = self._rng.uniform(12.0, 16.0)
        elif pass_dist < 30.0:
            pass_speed = self._rng.uniform(16.0, 22.0)
        else:
            pass_speed = self._rng.uniform(20.0, 28.0)

        # Lead the target slightly
        lead = min(pass_dist / pass_speed * 0.3, 1.5)
        target_bx = target.x + target.vx * lead
        target_by = target.y + target.vy * lead

        # Release ball
        carrier.has_ball = False
        self.ball.in_flight = True
        self.ball.flight_target_x = _clip(target_bx, 1.0, PITCH_X - 1.0)
        self.ball.flight_target_y = _clip(target_by, 1.0, PITCH_Y - 1.0)
        self.ball.flight_speed = pass_speed
        self.ball.carrier_id = target.player_id
        self.ball.carrier_team = target.team
        target.has_ball = True

        # Occasional turnover
        if self._rng.random() < 0.10:
            self._turnover()

        self._next_pass_t = self.t + self._rng.uniform(0.8, 2.5)

    def _turnover(self) -> None:
        for p in self.players:
            p.has_ball = False
        opp = "away" if self.ball.carrier_team == "home" else "home"
        opponents = [p for p in self.players if p.team == opp and p.role != "GK"]
        if not opponents:
            return
        nearest = min(opponents, key=lambda p: (p.x - self.ball.x)**2 + (p.y - self.ball.y)**2)
        nearest.has_ball = True
        self.ball.carrier_id = nearest.player_id
        self.ball.carrier_team = opp
        self.ball.in_flight = False

    # ── match events (goals, shots, cards, corners) ─────────────────────
    def _maybe_match_event(self) -> None:
        if self.t < self._next_event_t:
            return
        minute = int(self.t / 60)

        # Determine which team has the ball
        carrier = next((p for p in self.players if p.has_ball), None)
        team = carrier.team if carrier else "home"

        # Event probabilities scaled to real PL match rates
        # ~25 shots per match, ~10 corners, ~20 fouls, ~3 cards, ~2.7 goals
        roll = self._rng.random()

        if roll < 0.08:
            # SHOT — use xG from PL preset if available
            is_on_target = self._rng.random() < 0.35
            attacker = self._pick_attacker(team)
            xg = self._rng.uniform(0.03, 0.25)

            if self._pl_preset:
                # Use real player xG data to scale shot quality
                squad = self._pl_preset.home_squad if team == "home" else self._pl_preset.away_squad
                pl_player = next((p for p in squad if p.number == attacker.number), None)
                if pl_player and pl_player.xg90 > 0:
                    xg = self._rng.uniform(0.05, min(0.45, pl_player.xg90 * 1.5))

            if team == "home":
                self._home_xg += xg
            else:
                self._away_xg += xg

            # GOAL check — probability = xG
            scored = self._rng.random() < xg * 2.2  # slight boost for excitement
            if scored:
                if team == "home":
                    self._home_score += 1
                else:
                    self._away_score += 1
                self._match_events.append({
                    "minute": minute,
                    "type": "goal",
                    "team": team,
                    "player": attacker.player_id,
                    "player_number": attacker.number,
                    "xg": round(xg, 2),
                })
            else:
                self._match_events.append({
                    "minute": minute,
                    "type": "shot_on_target" if is_on_target else "shot",
                    "team": team,
                    "player": attacker.player_id,
                    "player_number": attacker.number,
                    "xg": round(xg, 2),
                })
        elif roll < 0.15:
            # CORNER
            self._match_events.append({
                "minute": minute,
                "type": "corner",
                "team": team,
            })
        elif roll < 0.25:
            # FOUL
            fouler = self._rng.choice([p for p in self.players if p.team != team and p.role != "GK"])
            is_card = self._rng.random() < 0.15
            self._match_events.append({
                "minute": minute,
                "type": "yellow_card" if is_card else "foul",
                "team": "away" if team == "home" else "home",
                "player": fouler.player_id,
                "player_number": fouler.number,
            })

        self._next_event_t = self.t + self._rng.uniform(30, 180)

    def _pick_attacker(self, team: str) -> _PlayerState:
        attackers = [p for p in self.players if p.team == team and p.role in ("ST", "LW", "RW", "RCM", "LCM")]
        if not attackers:
            attackers = [p for p in self.players if p.team == team and p.role != "GK"]
        return self._rng.choice(attackers) if attackers else self.players[0]

    # ── scenarios — DRAMATIC, IMMEDIATE shifts ─────────────────────────
    def _apply_scenario(self, scenario: str) -> None:
        # Track the scenario for get_active_scenarios() and insight generation.
        # Use the max perturb_until that this scenario sets.
        perturb_durations = {
            "under_run": 5.0, "pressing_shift": 8.0, "convergence": 4.0,
            "high_press": 10.0, "counter_press": 10.0, "trap_sideline": 7.0,
            "trap_corner": 6.0, "mid_block": 12.0, "low_block": 12.0,
            "man_mark": 10.0, "zonal": 10.0, "drop_deep": 10.0,
            "hold_line": 15.0, "step_up": 10.0,
        }
        dur = perturb_durations.get(scenario, 8.0)
        self._active_scenario_map[scenario] = self.t + dur

        if scenario == "under_run":
            for p in self.players:
                if p.team == "home" and p.role == "ST":
                    p.perturb_until = self.t + 5.0
                    p.anchor_shift_x = -20.0
                    p.anchor_shift_y = 0.0
        elif scenario == "pressing_shift":
            for p in self.players:
                if p.team == "away" and p.role != "GK":
                    p.perturb_until = self.t + 8.0
                    p.anchor_shift_x = -30.0
        elif scenario == "convergence":
            for p in self.players:
                if p.team == "home" and p.role in ("LCM", "CM", "RCM"):
                    p.perturb_until = self.t + 4.0
                    p.anchor_shift_x = (self.ball.x - p.base_x) * 0.8
                    p.anchor_shift_y = (self.ball.y - p.base_y) * 0.8
        elif scenario in ("high_press", "counter_press"):
            # DRAMATIC: entire home outfield surges 30m forward
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = +30.0
        elif scenario == "trap_sideline":
            for p in self.players:
                if p.team == "home" and p.role in ("LCM", "LW", "LB"):
                    p.perturb_until = self.t + 7.0
                    p.anchor_shift_y = -12.0
                elif p.team == "home" and p.role in ("RCM", "RW", "RB"):
                    p.perturb_until = self.t + 7.0
                    p.anchor_shift_y = -6.0
        elif scenario == "trap_corner":
            corner_x = 95.0 if self.ball.x > 52.5 else 10.0
            corner_y = 63.0 if self.ball.y > 34.0 else 5.0
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 6.0
                    p.anchor_shift_x = (corner_x - p.base_x) * 0.55
                    p.anchor_shift_y = (corner_y - p.base_y) * 0.55
        elif scenario == "mid_block":
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 12.0
                    p.anchor_shift_x = (48.0 - p.base_x) * 0.5
        elif scenario == "low_block":
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 12.0
                    p.anchor_shift_x = (18.0 - p.base_x) * 0.65
        elif scenario == "man_mark":
            away = [p for p in self.players if p.team == "away" and p.role != "GK"]
            for p in self.players:
                if p.team != "home" or p.role == "GK" or not away:
                    continue
                closest = min(away, key=lambda a: (a.x - p.x)**2 + (a.y - p.y)**2)
                p.perturb_until = self.t + 10.0
                p.anchor_shift_x = (closest.base_x - p.base_x) * 0.7
                p.anchor_shift_y = (closest.base_y - p.base_y) * 0.7
        elif scenario == "zonal":
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = 0.0
                    p.anchor_shift_y = 0.0
        elif scenario == "drop_deep":
            for p in self.players:
                if p.team == "home" and p.role != "GK":
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = -15.0
        elif scenario == "hold_line":
            backline = [p for p in self.players if p.team == "home" and p.role in ("LB", "LCB", "RCB", "RB")]
            if backline:
                avg_x = sum(p.base_x for p in backline) / len(backline)
                for p in backline:
                    p.perturb_until = self.t + 15.0
                    p.anchor_shift_x = (avg_x - p.base_x)
        elif scenario == "step_up":
            for p in self.players:
                if p.team == "home" and p.role in ("LB", "LCB", "RCB", "RB"):
                    p.perturb_until = self.t + 10.0
                    p.anchor_shift_x = +12.0


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
