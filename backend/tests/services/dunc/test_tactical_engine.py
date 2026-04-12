"""Tactical engine + scenario detector tests.

We do NOT exercise the BTUT convergence pass here — that's defensive and
optional. We test the cheap detectors and the happy path of the engine
against a fake twin snapshot.
"""

from __future__ import annotations

from app.services.dunc.insights import InsightStream
from app.services.dunc.scenarios import (
    detect_convergence_moment,
    detect_pressing_shift,
    detect_under_run,
)
from app.services.dunc.simulator import MatchPreset, MatchSimulator
from app.services.dunc.tactical_engine import TacticalEngine
from app.services.dunc.twins import DigitalTwin, DigitalTwinRegistry


def _home_mid(role: str, number: int, x: float, y: float, vx: float = 0.0) -> DigitalTwin:
    return DigitalTwin(
        player_id=f"H{number:02d}",
        team="home",
        number=number,
        role=role,
        x=x,
        y=y,
        vx=vx,
        speed=abs(vx),
    )


def test_under_run_detector_fires_when_striker_backtracks():
    twins = [
        _home_mid("ST", 9, x=70.0, y=34.0, vx=-1.5),
        _home_mid("LCM", 8, x=55.0, y=22.0, vx=2.0),
        _home_mid("CM", 6, x=55.0, y=34.0, vx=2.2),
        _home_mid("RCM", 10, x=55.0, y=46.0, vx=1.9),
    ]
    insights = detect_under_run(t=120.0, twins=twins, ball_xy=(62.0, 34.0))
    assert len(insights) == 1
    i = insights[0]
    assert i.kind == "under_run"
    assert i.severity == "critical"
    assert "H09" in i.actors
    assert set(["H08", "H06", "H10"]).issubset(set(i.actors))


def test_under_run_detector_silent_when_front_line_aligned():
    twins = [
        _home_mid("ST", 9, x=70.0, y=34.0, vx=2.1),
        _home_mid("CM", 6, x=55.0, y=34.0, vx=2.2),
    ]
    assert detect_under_run(120.0, twins, (62.0, 34.0)) == []


def test_pressing_shift_detector_fires_when_away_advances():
    away_outfielders = [
        DigitalTwin(
            player_id=f"A{n:02d}",
            team="away",
            number=n,
            role="CM" if n >= 6 else "CB",
            x=40.0,   # deep in home's half
            y=34.0,
            speed=2.0,
        )
        for n in range(2, 12)
    ]
    insights = detect_pressing_shift(200.0, away_outfielders, (55.0, 34.0))
    assert len(insights) == 1
    assert insights[0].kind == "pressing_shift"


def test_convergence_detector_fires_for_tight_triangle():
    twins = [
        _home_mid("LCM", 8, x=55.0, y=34.0),
        _home_mid("CM", 6, x=56.0, y=34.5),
        _home_mid("RCM", 10, x=55.5, y=33.5),
    ]
    hits = detect_convergence_moment(50.0, twins, (55.0, 34.0))
    assert len(hits) == 1
    assert hits[0].kind == "convergence"


def test_tactical_engine_tick_produces_insights_on_triggered_sim():
    sim = MatchSimulator(MatchPreset(seed=3))
    twins = DigitalTwinRegistry()
    engine = TacticalEngine()
    stream = InsightStream()

    # Warm up the simulation
    for _ in range(30):
        frame = sim.step()
        twins.ingest(frame)
        engine.tick(frame.t, twins, (frame.ball.x, frame.ball.y), stream)

    # Drain any warmup insights
    stream.drain_new()

    # Fire the pressing shift and step forward so the detector sees it
    sim.trigger("pressing_shift")
    for _ in range(80):
        frame = sim.step()
        twins.ingest(frame)
        engine.tick(frame.t, twins, (frame.ball.x, frame.ball.y), stream)

    kinds = {i.kind for i in stream.recent(100)}
    # We expect either pressing_shift or (acceptably) a convergence/under_run
    # side effect from the perturbation. The important thing is that the
    # engine produced *something*.
    assert len(stream.recent(100)) >= 1, "engine must emit at least one insight after a triggered scenario"
    assert any(k in kinds for k in {"pressing_shift", "convergence", "under_run"}), kinds
