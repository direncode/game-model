"""Pydantic schemas for the D-U-N-C API.

Keep these intentionally thin — the dataclasses in `services/dunc/` are the
source of truth. These are the shapes crossing the HTTP boundary.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["manager", "technical_staff"]
Scenario = Literal[
    "under_run", "pressing_shift", "convergence",
    "high_press", "counter_press", "trap_sideline", "trap_corner",
    "mid_block", "low_block", "man_mark", "zonal",
    "drop_deep", "hold_line", "step_up",
]
MatchStatus = Literal["idle", "running", "paused", "finished"]


class MatchCreateRequest(BaseModel):
    preset: str = Field(default="demo", description="Simulator preset name")
    seed: int | None = Field(default=None, description="Optional deterministic seed")
    hz: float = Field(default=10.0, ge=1.0, le=120.0, description="Tick rate in Hz")
    pl_preset: str | None = Field(default=None, description="PL match preset key, e.g. 'ars_vs_mci'")


class MatchSummaryOut(BaseModel):
    id: str
    name: str
    status: MatchStatus
    clock_sec: float
    hz: float
    subscribers: int
    created_at: float


class ScenarioTriggerRequest(BaseModel):
    scenario: Scenario


class AgentQueryRequest(BaseModel):
    match_id: str
    role: Role
    question: str


class AgentReplyOut(BaseModel):
    role: Role
    question: str
    answer: str
    citations: list[str] = Field(default_factory=list)
    style: Literal["concise", "detailed"]


class InsightOut(BaseModel):
    id: str
    t: float
    kind: str
    severity: str
    title: str
    summary: str
    actors: list[str] = Field(default_factory=list)
    evidence: dict = Field(default_factory=dict)
    audience: list[Role] = Field(default_factory=list)


class MatchStateOut(BaseModel):
    summary: MatchSummaryOut
    recent_insights: list[InsightOut]


# ── Prediction Engine schemas ─────────────────────────────────────────


class ProbabilitySet(BaseModel):
    home: float = Field(ge=0.0, le=1.0)
    draw: float = Field(ge=0.0, le=1.0)
    away: float = Field(ge=0.0, le=1.0)


class MatchPredictionOut(BaseModel):
    match_key: str
    home_team: str
    away_team: str
    league: str
    date: str

    bookmaker: ProbabilitySet
    polymarket: ProbabilitySet | None = None
    ml_model: ProbabilitySet

    kl_divergence_bk_poly: float | None = None
    max_divergence: float | None = None
    sources_agree: bool
    blended: ProbabilitySet

    claude_report: str | None = None
    confidence: Literal["high", "medium", "low"]

    model_accuracy: float
    model_last_trained: str


class MatchAnalysisRequest(BaseModel):
    home_team: str
    away_team: str
    league: str = Field(default="Premier League")


class ModelStatusOut(BaseModel):
    status: Literal["ready", "training", "cold"]
    accuracy: float | None = None
    log_loss: float | None = None
    last_trained: str | None = None
    matches_in_dataset: int = 0
    leagues: list[str] = Field(default_factory=list)
