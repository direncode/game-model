"""Agent stub behavior tests.

These are lightweight: we assert shape + routing, not exact wording.
"""

from __future__ import annotations

from app.services.dunc.agents import DuncAgent
from app.services.dunc.insights import Insight
from app.services.dunc.twins import DigitalTwin


def _twins():
    return [
        DigitalTwin(
            player_id="H09",
            team="home",
            number=9,
            role="ST",
            x=70.0,
            y=34.0,
            speed=2.0,
            distance_m=4200.0,
            high_intensity_m=380.0,
            sprint_count=12,
            fatigue=0.42,
        ),
        DigitalTwin(
            player_id="H06",
            team="home",
            number=6,
            role="CM",
            x=55.0,
            y=34.0,
            speed=1.5,
            distance_m=5800.0,
            high_intensity_m=520.0,
            sprint_count=15,
            fatigue=0.61,
        ),
    ]


def _insight(kind: str, tid: str = "test-1") -> Insight:
    return Insight(
        id=tid,
        t=12.3,
        kind=kind,
        severity="notable",
        title="Test",
        summary="test",
        actors=["H09"],
        evidence={"striker_vx": -1.2, "midfield_vx_avg": 2.1, "share_in_home_half": 0.85, "away_block_x": 42.0},
    )


def test_agent_manager_reply_is_concise():
    agent = DuncAgent()
    reply = agent.generate_reply(
        role="manager",
        question="is the striker under-running?",
        twins=_twins(),
        recent_insights=[_insight("under_run")],
        ball_xy=(60.0, 34.0),
    )
    assert reply.role == "manager"
    assert reply.style == "concise"
    assert "test-1" in reply.citations


def test_agent_technical_staff_reply_is_detailed():
    agent = DuncAgent()
    reply = agent.generate_reply(
        role="technical_staff",
        question="tell me about the high press",
        twins=_twins(),
        recent_insights=[_insight("pressing_shift")],
        ball_xy=(60.0, 34.0),
    )
    assert reply.role == "technical_staff"
    assert reply.style == "detailed"


def test_agent_fatigue_routing():
    agent = DuncAgent()
    reply = agent.generate_reply(
        role="manager",
        question="whose legs are tired",
        twins=_twins(),
        recent_insights=[],
        ball_xy=(60.0, 34.0),
    )
    # Should name at least one player by number
    assert "#6" in reply.answer or "#9" in reply.answer


def test_agent_default_fallback_when_no_keyword_match():
    agent = DuncAgent()
    reply = agent.generate_reply(
        role="manager",
        question="random unrelated question",
        twins=_twins(),
        recent_insights=[_insight("under_run")],
        ball_xy=(60.0, 34.0),
    )
    assert reply.answer  # not empty
