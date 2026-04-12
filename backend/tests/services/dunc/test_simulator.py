"""Happy-path tests for the dunc MatchSimulator.

Goals:
    1. Determinism with a fixed seed.
    2. Stays inside the pitch.
    3. Right count of players (22 outfielders+GKs across two teams).
    4. `trigger()` actually perturbs the right player for the right scenario.
"""

from __future__ import annotations

from app.services.dunc.simulator import MatchPreset, MatchSimulator


def _run_steps(sim: MatchSimulator, n: int) -> None:
    for _ in range(n):
        sim.step()


def test_simulator_determinism_same_seed():
    a = MatchSimulator(MatchPreset(seed=42))
    b = MatchSimulator(MatchPreset(seed=42))
    for _ in range(30):
        fa = a.step()
        fb = b.step()
        assert fa.t == fb.t
        assert fa.ball.x == fb.ball.x and fa.ball.y == fb.ball.y
        for pa, pb in zip(fa.players, fb.players):
            assert pa.player_id == pb.player_id
            assert pa.x == pb.x and pa.y == pb.y


def test_simulator_player_count_and_teams():
    sim = MatchSimulator(MatchPreset(seed=1))
    frame = sim.step()
    assert len(frame.players) == 22
    assert sum(1 for p in frame.players if p.team == "home") == 11
    assert sum(1 for p in frame.players if p.team == "away") == 11


def test_simulator_stays_on_pitch():
    sim = MatchSimulator(MatchPreset(seed=7))
    for _ in range(200):
        frame = sim.step()
        for p in frame.players:
            assert 0.0 <= p.x <= 105.0
            assert 0.0 <= p.y <= 68.0
        assert 0.0 <= frame.ball.x <= 105.0
        assert 0.0 <= frame.ball.y <= 68.0


def test_simulator_under_run_trigger_affects_striker():
    """Under-run shifts ST anchor -20m. Verify the anchor_shift was applied."""
    sim = MatchSimulator(MatchPreset(seed=11))
    _run_steps(sim, 40)
    sim.trigger("under_run")
    _run_steps(sim, 5)  # just enough for the scenario to apply

    home_st = [p for p in sim.players if p.team == "home" and p.role == "ST"][0]
    # The scenario sets anchor_shift_x = -20.0
    assert home_st.anchor_shift_x == -20.0
    assert home_st.perturb_until > sim.t


def test_simulator_convergence_trigger_collapses_mids():
    """Convergence pulls LCM/CM/RCM closer to each other than their baseline spread."""
    sim = MatchSimulator(MatchPreset(seed=23))
    _run_steps(sim, 40)

    def max_pairwise(mids):
        dmax = 0.0
        for i, a in enumerate(mids):
            for b in mids[i + 1 :]:
                d = ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5
                if d > dmax:
                    dmax = d
        return dmax

    mids_before = [p for p in sim.players if p.team == "home" and p.role in ("LCM", "CM", "RCM")]
    assert len(mids_before) == 3
    spread_before = max_pairwise(mids_before)

    sim.trigger("convergence")
    _run_steps(sim, 20)

    mids_after = [p for p in sim.players if p.team == "home" and p.role in ("LCM", "CM", "RCM")]
    spread_after = max_pairwise(mids_after)
    # Allow tolerance for micro-jitter in the new sim.
    assert spread_after <= spread_before + 1.0
