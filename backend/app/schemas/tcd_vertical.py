"""Pydantic schemas for the TCD-JEPA vertical API."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.crystallization.vertical_types import VerticalPreset


class VerticalCreateRequest(BaseModel):
    preset: VerticalPreset = VerticalPreset.GENERIC


class VerticalCreateResponse(BaseModel):
    id: uuid.UUID
    preset: VerticalPreset
    created_at: datetime


class CrystallizeRequest(BaseModel):
    btut_job_id: uuid.UUID
    min_quality: float = 0.0


class IncrementalPushRequest(BaseModel):
    embeddings: list[list[float]]
    ids: list[str]


class ModuleResponse(BaseModel):
    id: uuid.UUID
    vertical: str
    module_type: str
    purity: float
    quality_score: float
    members: list[str]
    provenance_job_id: str | None
    created_at: datetime


class ModuleListResponse(BaseModel):
    modules: list[ModuleResponse]
    total: int


class RouteRequest(BaseModel):
    signal: list[float] = Field(..., min_length=1)
    top_k: int = Field(1, ge=1, le=10)


class RouteDecisionResponse(BaseModel):
    module_id: str | None
    score: float
    reason: str


class RouteResponse(BaseModel):
    decisions: list[RouteDecisionResponse]


class ExportFormatQuery(BaseModel):
    format: Literal["json", "pt", "onnx"] = "json"


# ── Intelligence schemas ─────────────────────────────────────────


class IntelligenceInsightResponse(BaseModel):
    category: str
    severity: str
    title: str
    description: str
    confidence: float
    evidence: list[str] = []
    persistence_bars: list[dict] | None = None


class IntelligenceEngineResponse(BaseModel):
    engine: str
    insights: list[IntelligenceInsightResponse]
    insight_count: int


class IntelligenceSummaryResponse(BaseModel):
    engines: dict[str, IntelligenceEngineResponse]
    total_insights: int


# ── Demo schemas ─────────────────────────────────────────────────


class DemoStartResponse(BaseModel):
    session_id: str
    job_id: str
    ws_url: str


# ── Agent schemas ────────────────────────────────────────────────


class AgentQueryRequest(BaseModel):
    question: str


class AgentQueryResponse(BaseModel):
    answer: str
    sources: list[str]
    confidence: float
    engine: str | None


# ── Marketplace schemas ──────────────────────────────────────────


class ModulePricingResponse(BaseModel):
    module_id: str
    price_credits: float
    tier: str
    pricing_factors: dict


class MarketplaceModuleResponse(BaseModel):
    id: uuid.UUID
    vertical: str
    module_type: str
    purity: float
    quality_score: float
    members: list[str]
    price_credits: float
    tier: str


class MarketplaceResponse(BaseModel):
    modules: list[MarketplaceModuleResponse]
    total: int


class LicenseResponse(BaseModel):
    license_key: str
    module_id: str
    issued_at: str
    valid_until: str
    tier: str
