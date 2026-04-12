"""Heuristic scenario detectors for all D-U-N-C tactical triggers.

Five detectors cover all 14+ trigger types:
    1. detect_under_run         — striker drops while midfield pushes
    2. detect_pressing_shift    — away block advances into home half
    3. detect_convergence_moment — midfield triangle compresses
    4. detect_formation_shift   — ANY active scenario perturbation on 4+ players
    5. detect_block_shape       — defensive line compression (hold_line, low/mid block)
"""

from __future__ import annotations

import math
from typing import Iterable

from app.services.dunc.insights import Insight
from app.services.dunc.twins import DigitalTwin

# Scenario labels for human-readable insight summaries.
_SCENARIO_LABELS = {
    "high_press": "High press",
    "counter_press": "Counter-press",
    "trap_sideline": "Sideline trap",
    "trap_corner": "Corner trap",
    "mid_block": "Mid block",
    "low_block": "Low block",
    "man_mark": "Man marking",
    "zonal": "Zonal reset",
    "drop_deep": "Drop deep",
    "hold_line": "Hold the line",
    "step_up": "Step up",
    "under_run": "Under-run",
    "pressing_shift": "Pressing shift",
    "convergence": "Convergence",
}

_SCENARIO_SUMMARIES = {
    "high_press": "Entire outfield surging forward — aggressive high press activated.",
    "counter_press": "Immediate counter-press on loss of possession.",
    "trap_sideline": "Funnelling the opposition toward the touchline.",
    "trap_corner": "Collapsing the block toward the nearest corner flag.",
    "mid_block": "Compact mid-block forming around the halfway line.",
    "low_block": "Deep defensive block — dropping behind the ball.",
    "man_mark": "Man-to-man marking engaged — each player shadowing an opponent.",
    "zonal": "Zonal defensive reset — returning to base formation.",
    "drop_deep": "Defensive line dropping 15m deeper.",
    "hold_line": "Back four compressing to a flat line.",
    "step_up": "Defensive line stepping up 12m.",
}


class ScenarioDetector:
    """Stateful wrapper with hysteresis cooldowns."""

    _COOLDOWN = {
        "under_run": 6.0,
        "pressing_shift": 8.0,
        "convergence": 5.0,
        "transition": 4.0,  # formation_shift
        "info": 3.0,        # block_shape
    }

    def __init__(self) -> None:
        self._last_fired: dict[str, float] = {}

    def detect(
        self,
        t: float,
        twins: list[DigitalTwin],
        ball_xy: tuple[float, float],
        active_scenarios: list[dict] | None = None,
    ) -> list[Insight]:
        out: list[Insight] = []
        detectors = [
            detect_under_run,
            detect_pressing_shift,
            detect_convergence_moment,
        ]
        for fn in detectors:
            for insight in fn(t, twins, ball_xy):
                last = self._last_fired.get(insight.kind, -math.inf)
                if t - last < self._COOLDOWN.get(insight.kind, 5.0):
                    continue
                self._last_fired[insight.kind] = t
                out.append(insight)

        # Generic detectors that use active_scenarios metadata
        if active_scenarios:
            for insight in detect_formation_shift(t, twins, ball_xy, active_scenarios):
                last = self._last_fired.get(f"transition-{insight.evidence.get('scenario','')}", -math.inf)
                if t - last < 8.0:
                    continue
                self._last_fired[f"transition-{insight.evidence.get('scenario','')}"] = t
                out.append(insight)

            for insight in detect_block_shape(t, twins, ball_xy, active_scenarios):
                last = self._last_fired.get("block_shape", -math.inf)
                if t - last < 10.0:
                    continue
                self._last_fired["block_shape"] = t
                out.append(insight)

        return out


# ── Detector 1: striker under-run ──────────────────────────────────────
def detect_under_run(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
) -> list[Insight]:
    striker = next((tw for tw in twins if tw.team == "home" and tw.role == "ST"), None)
    if striker is None or striker.vx > -0.5:
        return []

    pushing_mids = [
        tw for tw in twins
        if tw.team == "home"
        and tw.role in ("LCM", "CM", "RCM")
        and tw.vx > 1.5
    ]
    if len(pushing_mids) < 2:
        return []
    if ball_xy[0] < 55.0:
        return []

    mid_ids = [m.player_id for m in pushing_mids]
    return [
        Insight(
            id=f"under_run-{int(t * 10)}",
            t=t,
            kind="under_run",
            severity="critical",
            title="Under-run from the striker",
            summary=(
                f"#{striker.number} ({striker.role}) is dropping away from the pass "
                f"while {', '.join('#' + str(m.number) for m in pushing_mids)} are "
                f"driving forward. The advanced line is breaking from the front."
            ),
            actors=[striker.player_id, *mid_ids],
            evidence={
                "striker_vx": round(striker.vx, 2),
                "midfield_vx_avg": round(sum(m.vx for m in pushing_mids) / len(pushing_mids), 2),
                "ball_x": round(ball_xy[0], 1),
            },
            audience=["manager", "technical_staff"],
        )
    ]


# ── Detector 2: pressing shift (loosened thresholds) ───────────────────
def detect_pressing_shift(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
) -> list[Insight]:
    away_outfield = [tw for tw in twins if tw.team == "away" and tw.role != "GK"]
    if not away_outfield:
        return []
    in_home_half = sum(1 for tw in away_outfield if tw.x < 75.0)
    ratio = in_home_half / len(away_outfield)
    if ratio < 0.6:
        return []

    avg_x = sum(tw.x for tw in away_outfield) / len(away_outfield)
    return [
        Insight(
            id=f"pressing_shift-{int(t * 10)}",
            t=t,
            kind="pressing_shift",
            severity="notable",
            title="Opponent has triggered a high press",
            summary=(
                f"The away block has advanced — {int(ratio * 100)}% of outfielders "
                f"inside x={75}m. Mean block position: {avg_x:.0f}m. "
                f"Expect immediate pressure on first and second ball."
            ),
            actors=[tw.player_id for tw in away_outfield],
            evidence={
                "away_block_x": round(avg_x, 1),
                "share_in_home_half": round(ratio, 2),
            },
            audience=["manager", "technical_staff"],
        )
    ]


# ── Detector 3: convergence moment (loosened to 12m) ───────────────────
def detect_convergence_moment(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
) -> list[Insight]:
    mids = [tw for tw in twins if tw.team == "home" and tw.role in ("LCM", "CM", "RCM")]
    if len(mids) < 3:
        return []

    dmax = 0.0
    for i, a in enumerate(mids):
        for b in mids[i + 1 :]:
            d = math.hypot(a.x - b.x, a.y - b.y)
            if d > dmax:
                dmax = d
    if dmax > 12.0:
        return []

    return [
        Insight(
            id=f"converge-{int(t * 10)}",
            t=t,
            kind="convergence",
            severity="notable",
            title="Midfield triangle compressing",
            summary=(
                f"Three central midfielders within {dmax:.1f}m of each other. "
                f"Numerical superiority in the central channel."
            ),
            actors=[m.player_id for m in mids],
            evidence={
                "max_pairwise_m": round(dmax, 2),
                "midfielders": len(mids),
            },
            audience=["manager", "technical_staff"],
        )
    ]


# ── Detector 4: generic formation shift (covers ALL triggers) ─────────
def detect_formation_shift(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
    active_scenarios: list[dict],
) -> list[Insight]:
    """Fire once when a scenario activates and affects 4+ players."""
    out: list[Insight] = []
    for sc in active_scenarios:
        name = sc.get("name", "")
        affected = sc.get("affected_count", 0)
        if affected < 4:
            continue
        label = _SCENARIO_LABELS.get(name, name.replace("_", " ").title())
        summary = _SCENARIO_SUMMARIES.get(name, f"Formation shift: {label} activated.")
        out.append(Insight(
            id=f"shift-{name}-{int(t * 10)}",
            t=t,
            kind="transition",
            severity="notable",
            title=f"Formation shift: {label}",
            summary=summary,
            actors=[],
            evidence={
                "scenario": name,
                "affected_players": affected,
                "remaining_sec": round(sc.get("remaining_sec", 0), 1),
            },
            audience=["manager", "technical_staff"],
        ))
    return out


# ── Detector 5: block shape (backline compression) ────────────────────
def detect_block_shape(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
    active_scenarios: list[dict],
) -> list[Insight]:
    """Fire when the defensive line is notably compressed or shifted."""
    block_scenarios = {"hold_line", "low_block", "mid_block", "drop_deep", "step_up"}
    active_names = {sc["name"] for sc in active_scenarios}
    if not active_names & block_scenarios:
        return []

    backline = [tw for tw in twins if tw.team == "home" and tw.role in ("LB", "LCB", "RCB", "RB")]
    if len(backline) < 3:
        return []

    xs = [tw.x for tw in backline]
    avg_x = sum(xs) / len(xs)
    spread = max(xs) - min(xs)

    active_block = (active_names & block_scenarios).pop()
    label = _SCENARIO_LABELS.get(active_block, active_block)

    return [
        Insight(
            id=f"block-{int(t * 10)}",
            t=t,
            kind="info",
            severity="info",
            title=f"Defensive shape: {label}",
            summary=(
                f"Back line at x={avg_x:.0f}m, spread={spread:.1f}m. "
                f"{'Compact and flat.' if spread < 6 else 'Holding width.'}"
            ),
            actors=[tw.player_id for tw in backline],
            evidence={
                "backline_avg_x": round(avg_x, 1),
                "backline_spread": round(spread, 1),
                "scenario": active_block,
            },
            audience=["manager", "technical_staff"],
        )
    ]
