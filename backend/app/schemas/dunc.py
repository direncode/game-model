"""Pydantic schemas for the D-U-N-C API.

Keep these intentionally thin — the dataclasses in `services/dunc/` are the
source of truth. These are the shapes crossing the HTTP boundary.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["manager", "technical_staff"]
Scenario = Literal["under_run", "pressing_shift", "convergence"]
MatchStatus = Literal["idle", "running", "paused", "finished"]


class MatchCreateRequest(BaseModel):
    preset: str = Field(default="demo", description="Simulator preset name")
    seed: int | None = Field(default=None, description="Optional deterministic seed")


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
