"""Heuristic scenario detectors — the three core D-U-N-C user scenarios.

Each detector is a pure function of (t, twins_snapshot, ball_xy) that returns
zero or more `Insight`s. They are intentionally simple and deterministic —
the "intelligence" of the engine comes from composing them plus the windowed
BTUT convergence pass in `tactical_engine.py`, not from any one detector
being smart on its own.

Mapped to the three user scenarios the brief called out:
    1. Striker under-ran  →  detect_under_run
    2. Complex convergence moment the staff want to explain to manager
       →  tactical_engine._convergence_pass (BTUT) + detect_convergence_moment
    3. Manager wants whole staff aligned on a pressing shift
       →  detect_pressing_shift
"""

from __future__ import annotations

import math
from typing import Iterable

from app.services.dunc.insights import Insight
from app.services.dunc.twins import DigitalTwin


class ScenarioDetector:
    """Stateful wrapper around the pure detectors.

    Keeps a tiny amount of hysteresis state so we don't emit the same
    insight 10 times in a row for the same underlying tactical moment.
    """

    # Cooldown window per insight kind, in seconds of simulated match time.
    _COOLDOWN = {
        "under_run": 6.0,
        "pressing_shift": 12.0,
        "convergence": 6.0,
    }

    def __init__(self) -> None:
        self._last_fired: dict[str, float] = {}

    def detect(
        self,
        t: float,
        twins: list[DigitalTwin],
        ball_xy: tuple[float, float],
    ) -> list[Insight]:
        out: list[Insight] = []
        for fn in (detect_under_run, detect_pressing_shift, detect_convergence_moment):
            for insight in fn(t, twins, ball_xy):
                last = self._last_fired.get(insight.kind, -math.inf)
                if t - last < self._COOLDOWN.get(insight.kind, 5.0):
                    continue
                self._last_fired[insight.kind] = t
                out.append(insight)
        return out


# ── Scenario 1: striker under-ran the midfielders' pass ───────────────
def detect_under_run(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
) -> list[Insight]:
    """Fire when a home striker fails to press forward while his midfield does.

    Criterion:
        The home ST has vx < 0 (moving backward relative to attack direction)
        AND at least two home midfielders have vx > 1.5 m/s AND the ball is
        in the attacking half.
    """
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
    if ball_xy[0] < 55.0:  # ball not yet in attacking half
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


# ── Scenario 3: opponent shifts to a high press ───────────────────────
def detect_pressing_shift(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
) -> list[Insight]:
    """Fire when the away team collectively advances toward the home goal.

    Criterion:
        The mean x coordinate of the away outfielders has shifted so that
        80% of them are inside x < 60 (the home half, since away attacks −x).
    """
    away_outfield = [tw for tw in twins if tw.team == "away" and tw.role != "GK"]
    if not away_outfield:
        return []
    in_home_half = sum(1 for tw in away_outfield if tw.x < 60.0)
    ratio = in_home_half / len(away_outfield)
    if ratio < 0.8:
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
                "The away side has moved the entire block into our half. "
                "Expect immediate pressure on first and second ball. "
                "Consider switching to direct vertical outlets."
            ),
            actors=[tw.player_id for tw in away_outfield],
            evidence={
                "away_block_x": round(avg_x, 1),
                "share_in_home_half": round(ratio, 2),
            },
            audience=["manager", "technical_staff"],
        )
    ]


# ── Scenario 2: complex convergence moment (spatial cluster) ──────────
def detect_convergence_moment(
    t: float,
    twins: list[DigitalTwin],
    ball_xy: tuple[float, float],
) -> list[Insight]:
    """Fire when three or more home midfielders collapse to within 5m of each other.

    The BTUT windowed pass also emits `convergence` insights; this one is a
    cheap per-tick sibling that catches instantaneous tight triangles.
    """
    mids = [tw for tw in twins if tw.team == "home" and tw.role in ("LCM", "CM", "RCM")]
    if len(mids) < 3:
        return []

    dmax = 0.0
    for i, a in enumerate(mids):
        for b in mids[i + 1 :]:
            d = math.hypot(a.x - b.x, a.y - b.y)
            if d > dmax:
                dmax = d
    if dmax > 5.0:
        return []

    return [
        Insight(
            id=f"converge-{int(t * 10)}",
            t=t,
            kind="convergence",
            severity="notable",
            title="Midfield triangle collapsing on the carrier",
            summary=(
                "Three central midfielders are inside a 5-metre triangle. "
                "This is the shape the staff wanted the manager to see — "
                "numerical superiority in the central channel right now."
            ),
            actors=[m.player_id for m in mids],
            evidence={
                "max_pairwise_m": round(dmax, 2),
                "midfielders": len(mids),
            },
            audience=["manager", "technical_staff"],
        )
    ]
