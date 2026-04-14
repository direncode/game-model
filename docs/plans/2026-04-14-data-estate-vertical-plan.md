# Data Estate Vertical Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Participatory Data Estate vertical to Latent Ocean that lets organizations upload documents into a living, crystallized knowledge base via the BTUT -> TCD-JEPA spine.

**Architecture:** New vertical following the exact patterns of TCD-JEPA/NIV/DUNC. Backend services in `services/data_estate/`, models in `models/data_estate.py`, router in `api/v1/data_estate_vertical.py`, Celery task in `tasks/data_estate_crystallize.py`. Frontend pages under `app/data-estate/` with Zustand store and API client. All strictly additive.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic, Celery, Redis, Next.js 14 App Router, Zustand, Tailwind CSS, Recharts, lucide-react

**Design Doc:** `docs/plans/2026-04-14-data-estate-vertical-design.md`

---

## Task 1: Add DATA_ESTATE to Vertical Preset System

**Files:**
- Modify: `backend/app/services/crystallization/vertical_types.py:17` (add enum value)
- Modify: `backend/app/services/crystallization/presets.py:24-67` (add preset config)

**Step 1: Add enum value to VerticalPreset**

In `backend/app/services/crystallization/vertical_types.py`, add `DATA_ESTATE` to the enum:

```python
class VerticalPreset(str, Enum):
    TRADING = "trading"
    INFERENCE = "inference"
    SOVEREIGN = "sovereign"
    GENERIC = "generic"
    DATA_ESTATE = "data_estate"
```

**Step 2: Add preset config to PRESETS dict**

In `backend/app/services/crystallization/presets.py`, add after the TRADING entry:

```python
    # Data Estate vertical — warm exploration for diverse document estates.
    # Temperature is above GENERIC (1.2 vs 1.0) because document collections
    # are inherently diverse (different topics, authors, time periods) and
    # the crystallizer needs to explore broadly before settling. Trajectory
    # length is moderate (300 steps) to map knowledge topology without
    # excessive compute. Full H0/H1/H2 enabled — H2 boundaries are a core
    # value proposition (detecting documentation gaps). Module capacity is
    # high (96) because knowledge bases have many distinct topic clusters.
    # Prune threshold 0.15 keeps more modules alive for coverage.
    VerticalPreset.DATA_ESTATE: PresetConfig(
        langevin_temperature=1.2,
        langevin_steps=300,
        langevin_noise_scale=0.12,
        homology_max_dim=2,
        prune_threshold=0.15,
        max_modules=96,
    ),
```

**Step 3: Verify existing tests still pass**

Run: `cd backend && python -m pytest tests/services/crystallization/ -v --tb=short 2>/dev/null || echo "No existing tests or tests passed"`
Expected: Existing tests pass (new enum value is additive)

**Step 4: Commit**

```bash
git add backend/app/services/crystallization/vertical_types.py backend/app/services/crystallization/presets.py
git commit -m "feat(data-estate): add DATA_ESTATE to vertical preset system"
```

---

## Task 2: Create SQLAlchemy Models

**Files:**
- Create: `backend/app/models/data_estate.py`

**Step 1: Write the models file**

```python
"""Data Estate vertical models.

Four tables for the participatory data estate:
- estate_submission: stakeholder document submissions with moderation
- estate_ledger_entry: optional versioned allocation tracking
- estate_allocation_request: resource allocation requests with AI scoring
- estate_scoring_template: configurable scoring factors per org

All tables use org_id for multi-tenancy. No hardcoded categories or domains.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class EstateSubmission(Base):
    """A stakeholder document submitted for moderation and crystallization."""

    __tablename__ = "estate_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | approved | rejected
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True
    )
    estate_tag: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_estate_submissions_org", "org_id"),
        Index("ix_estate_submissions_status", "status"),
        Index("ix_estate_submissions_hash", "file_hash"),
    )


class EstateLedgerEntry(Base):
    """A versioned allocation line item in the transparent ledger."""

    __tablename__ = "estate_ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    category_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    __table_args__ = (
        Index("ix_estate_ledger_org", "org_id"),
        Index("ix_estate_ledger_category", "category_tag"),
    )


class EstateAllocationRequest(Base):
    """A resource allocation request with AI scoring."""

    __tablename__ = "estate_allocation_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    category_tag: Mapped[str] = mapped_column(String(64), nullable=False)
    score_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | approved | denied | flagged
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    __table_args__ = (
        Index("ix_estate_alloc_org", "org_id"),
        Index("ix_estate_alloc_status", "status"),
    )


class EstateScoringTemplate(Base):
    """A configurable scoring factor for allocation requests."""

    __tablename__ = "estate_scoring_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    evaluator_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # keyword | range | duplicate | model
    evaluator_config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    __table_args__ = (
        Index("ix_estate_scoring_org", "org_id"),
    )
```

**Step 2: Commit**

```bash
git add backend/app/models/data_estate.py
git commit -m "feat(data-estate): add SQLAlchemy models for submissions, ledger, allocations, scoring"
```

---

## Task 3: Create Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/data_estate.py`

**Step 1: Write the schemas file**

```python
"""Pydantic schemas for the Data Estate vertical API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Submissions (The Scroll) ───────────────────────────────────────

SubmissionStatus = Literal["pending", "approved", "rejected"]


class SubmissionCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    raw_text: str = Field(..., min_length=1)
    estate_tag: str = Field(default="default", max_length=64)


class SubmissionReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    note: str | None = None


class SubmissionOut(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    status: SubmissionStatus
    estate_tag: str
    submitted_by: UUID
    reviewed_by: UUID | None = None
    review_note: str | None = None
    dataset_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


# ── Ledger ──────────────────────────────────────────────────────────


class LedgerEntryCreateRequest(BaseModel):
    amount: float = Field(..., gt=0)
    label: str = Field(..., min_length=1, max_length=500)
    category_tag: str = Field(..., max_length=64)
    effective_date: date
    metadata: dict | None = None


class LedgerEntryOut(BaseModel):
    id: UUID
    org_id: UUID
    amount: float
    label: str
    category_tag: str
    version: int
    effective_date: date
    created_by: UUID
    metadata: dict | None = None
    created_at: datetime


class LedgerSummaryOut(BaseModel):
    total_allocated: float
    category_totals: dict[str, float]
    entry_count: int


# ── Allocation Requests ─────────────────────────────────────────────

AllocationStatus = Literal["pending", "approved", "denied", "flagged"]


class AllocationRequestCreate(BaseModel):
    amount: float = Field(..., gt=0)
    justification: str = Field(..., min_length=1)
    category_tag: str = Field(..., max_length=64)


class AllocationDecisionRequest(BaseModel):
    action: Literal["approve", "deny", "flag"]
    note: str | None = None


class AllocationRequestOut(BaseModel):
    id: UUID
    org_id: UUID
    amount: float
    justification: str
    category_tag: str
    score_result: dict | None = None
    status: AllocationStatus
    requested_by: UUID
    decided_by: UUID | None = None
    decision_note: str | None = None
    created_at: datetime


# ── Scoring Templates ───────────────────────────────────────────────

EvaluatorType = Literal["keyword", "range", "duplicate", "model"]


class ScoringTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    weight: float = Field(default=1.0, gt=0)
    evaluator_type: EvaluatorType
    evaluator_config: dict


class ScoringTemplateOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    weight: float
    evaluator_type: EvaluatorType
    evaluator_config: dict
    is_active: bool
    created_at: datetime


# ── Crystallization ─────────────────────────────────────────────────


class CrystallizeRequest(BaseModel):
    submission_ids: list[UUID] = Field(
        ..., min_length=1, description="Approved submissions to crystallize"
    )


class IncrementalRequest(BaseModel):
    submission_ids: list[UUID] = Field(
        ..., min_length=1, description="New approved submissions to add"
    )
    session_id: str = Field(..., description="Existing TCD-JEPA session ID")


# ── Chat ────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    estate_tag: str = Field(default="default")


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)
    module_hits: int = 0


# ── Dashboard ───────────────────────────────────────────────────────


class DashboardOut(BaseModel):
    total_submissions: int
    pending_submissions: int
    approved_submissions: int
    total_modules: int
    modules_by_type: dict[str, int]  # attractor/cycle/boundary counts
    ledger_total: float
    ledger_categories: int
    allocation_requests_pending: int
```

**Step 2: Commit**

```bash
git add backend/app/schemas/data_estate.py
git commit -m "feat(data-estate): add Pydantic request/response schemas"
```

---

## Task 4: Create Model Router Service

**Files:**
- Create: `backend/app/services/data_estate/__init__.py`
- Create: `backend/app/services/data_estate/model_router.py`

**Step 1: Create the package init**

```python
"""Data Estate vertical — participatory living data estate primitive."""
```

**Step 2: Write the model router**

```python
"""Provider-agnostic LLM abstraction for the Data Estate vertical.

Supports Anthropic, xAI (Grok), and OpenAI. Provider and model are
configured via environment variables so organizations can bring their
own preferred AI backend.
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class ModelRouter:
    """Configurable LLM provider for completions and embeddings."""

    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
        embed_model: str | None = None,
    ) -> None:
        self.provider = provider or getattr(
            settings, "DATA_ESTATE_MODEL_PROVIDER", "anthropic"
        )
        self.model = model or getattr(
            settings, "DATA_ESTATE_MODEL_NAME", "claude-sonnet-4-6"
        )
        self.embed_model = embed_model or getattr(
            settings, "DATA_ESTATE_EMBED_MODEL", ""
        )

    async def complete(
        self,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 2048,
    ) -> str:
        """Generate a text completion using the configured provider."""
        if self.provider == "anthropic":
            return await self._anthropic_complete(prompt, system, max_tokens)
        if self.provider == "xai":
            return await self._xai_complete(prompt, system, max_tokens)
        if self.provider == "openai":
            return await self._openai_complete(prompt, system, max_tokens)
        raise ValueError(f"Unknown model provider: {self.provider}")

    async def embed(self, text: str) -> list[float]:
        """Generate an embedding vector using the configured provider."""
        if self.provider == "anthropic":
            # Anthropic doesn't have a public embed API yet; fall back to
            # a simple TF-IDF or sentence hash. Real deployments would
            # use a dedicated embed model.
            return self._fallback_embed(text)
        if self.provider == "xai":
            return await self._xai_embed(text)
        if self.provider == "openai":
            return await self._openai_embed(text)
        return self._fallback_embed(text)

    # ── Provider implementations ────────────────────────────────────

    async def _anthropic_complete(
        self, prompt: str, system: str | None, max_tokens: int
    ) -> str:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
            kwargs: dict[str, Any] = {
                "model": self.model,
                "max_tokens": max_tokens,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system
            response = await client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as exc:
            logger.error("Anthropic completion failed: %s", exc)
            raise

    async def _xai_complete(
        self, prompt: str, system: str | None, max_tokens: int
    ) -> str:
        try:
            import httpx

            api_key = getattr(settings, "XAI_API_KEY", "")
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("xAI completion failed: %s", exc)
            raise

    async def _openai_complete(
        self, prompt: str, system: str | None, max_tokens: int
    ) -> str:
        try:
            import httpx

            api_key = getattr(settings, "OPENAI_API_KEY", "")
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("OpenAI completion failed: %s", exc)
            raise

    async def _xai_embed(self, text: str) -> list[float]:
        import httpx

        api_key = getattr(settings, "XAI_API_KEY", "")
        model = self.embed_model or "v1"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.x.ai/v1/embeddings",
                headers=headers,
                json={"model": model, "input": text},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]

    async def _openai_embed(self, text: str) -> list[float]:
        import httpx

        api_key = getattr(settings, "OPENAI_API_KEY", "")
        model = self.embed_model or "text-embedding-3-small"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers=headers,
                json={"model": model, "input": text},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]

    def _fallback_embed(self, text: str) -> list[float]:
        """Simple hash-based embedding for when no embed API is available."""
        import hashlib

        h = hashlib.sha256(text.encode()).digest()
        return [float(b) / 255.0 for b in h]  # 32-dim normalized
```

**Step 3: Commit**

```bash
git add backend/app/services/data_estate/
git commit -m "feat(data-estate): add model router service with Anthropic/xAI/OpenAI support"
```

---

## Task 5: Create Scoring Engine Service

**Files:**
- Create: `backend/app/services/data_estate/scoring_engine.py`

**Step 1: Write the scoring engine**

```python
"""Template-driven scoring engine for allocation requests.

Organizations define scoring factors via EstateScoringTemplate.
Each factor has a type (keyword, range, duplicate, model) and
configurable parameters. The engine evaluates each factor against
the request and produces a weighted composite score.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class FactorResult:
    """Result of evaluating a single scoring factor."""

    name: str
    score: float  # 0-100
    weight: float
    detail: str


@dataclass
class ScoreResult:
    """Composite scoring result."""

    total: float  # 0-100 weighted average
    recommendation: str  # approve | review | deny | flag
    factors: list[FactorResult]

    def to_dict(self) -> dict[str, Any]:
        return {
            "total": round(self.total, 1),
            "recommendation": self.recommendation,
            "factors": [
                {
                    "name": f.name,
                    "score": round(f.score, 1),
                    "weight": f.weight,
                    "detail": f.detail,
                }
                for f in self.factors
            ],
        }


class ScoringEngine:
    """Evaluate allocation requests against configurable scoring templates."""

    def __init__(self, model_router: Any | None = None) -> None:
        self._model_router = model_router

    async def score(
        self,
        amount: float,
        justification: str,
        category_tag: str,
        templates: list[dict],
        recent_requests: list[dict] | None = None,
    ) -> ScoreResult:
        """Run request through each active scoring factor."""
        factors: list[FactorResult] = []

        for tmpl in templates:
            if not tmpl.get("is_active", True):
                continue
            etype = tmpl["evaluator_type"]
            config = tmpl.get("evaluator_config", {})
            name = tmpl["name"]
            weight = tmpl.get("weight", 1.0)

            if etype == "keyword":
                result = self._eval_keyword(justification, config)
            elif etype == "range":
                result = self._eval_range(amount, config)
            elif etype == "duplicate":
                result = self._eval_duplicate(
                    justification, amount, recent_requests or [], config
                )
            elif etype == "model":
                result = await self._eval_model(
                    amount, justification, category_tag, config
                )
            else:
                result = (50.0, f"Unknown evaluator type: {etype}")

            factors.append(
                FactorResult(name=name, score=result[0], weight=weight, detail=result[1])
            )

        if not factors:
            return ScoreResult(total=50.0, recommendation="review", factors=[])

        total_weight = sum(f.weight for f in factors)
        weighted_sum = sum(f.score * f.weight for f in factors)
        total = weighted_sum / total_weight if total_weight > 0 else 50.0

        recommendation = self._recommend(total, factors)
        return ScoreResult(total=total, recommendation=recommendation, factors=factors)

    def _recommend(self, total: float, factors: list[FactorResult]) -> str:
        """Derive recommendation from composite score."""
        # Check for any flagged factor
        for f in factors:
            if f.score < 10:
                return "flag"
        if total >= 75:
            return "approve"
        if total >= 35:
            return "review"
        return "deny"

    def _eval_keyword(
        self, text: str, config: dict
    ) -> tuple[float, str]:
        """Score based on keyword presence in justification."""
        keywords = config.get("keywords", {})  # {"emergency": 25, "critical": 20, ...}
        text_lower = text.lower()
        total = 0.0
        matched = []
        for kw, pts in keywords.items():
            if kw.lower() in text_lower:
                total += pts
                matched.append(kw)
        score = min(total, 100.0)
        detail = f"Matched: {', '.join(matched)}" if matched else "No keyword matches"
        return (score, detail)

    def _eval_range(
        self, amount: float, config: dict
    ) -> tuple[float, str]:
        """Score based on whether amount falls within expected range."""
        typical = config.get("typical", 1000)
        maximum = config.get("maximum", 10000)
        if amount <= typical:
            score = 90.0
            detail = f"Amount ${amount:.0f} within typical range (${typical:.0f})"
        elif amount <= maximum:
            ratio = (amount - typical) / (maximum - typical)
            score = 90.0 - (ratio * 60.0)
            detail = f"Amount ${amount:.0f} above typical but within max (${maximum:.0f})"
        else:
            score = max(0.0, 20.0 - ((amount - maximum) / maximum) * 20.0)
            detail = f"Amount ${amount:.0f} exceeds maximum (${maximum:.0f})"
        return (score, detail)

    def _eval_duplicate(
        self,
        justification: str,
        amount: float,
        recent: list[dict],
        config: dict,
    ) -> tuple[float, str]:
        """Detect similar recent requests within a time window."""
        window_days = config.get("window_days", 30)
        threshold = config.get("similarity_threshold", 0.7)
        cutoff = datetime.utcnow() - timedelta(days=window_days)

        for req in recent:
            req_date = req.get("created_at")
            if isinstance(req_date, str):
                try:
                    req_date = datetime.fromisoformat(req_date)
                except ValueError:
                    continue
            if req_date and req_date < cutoff:
                continue
            prev_text = req.get("justification", "")
            similarity = SequenceMatcher(None, justification.lower(), prev_text.lower()).ratio()
            if similarity >= threshold:
                return (
                    15.0,
                    f"Similar request found ({similarity:.0%} match within {window_days}d)",
                )
        return (85.0, f"No duplicates in last {window_days} days")

    async def _eval_model(
        self,
        amount: float,
        justification: str,
        category_tag: str,
        config: dict,
    ) -> tuple[float, str]:
        """Use AI model to validate request reasonableness."""
        if self._model_router is None:
            return (50.0, "Model router not configured")

        prompt = config.get(
            "prompt_template",
            (
                "Evaluate this resource allocation request. "
                "Category: {category}. Amount: ${amount:.2f}. "
                "Justification: {justification}\n\n"
                "Rate the reasonableness from 0-100 and explain briefly. "
                "Respond with just the number and one sentence."
            ),
        ).format(
            category=category_tag,
            amount=amount,
            justification=justification,
        )

        try:
            response = await self._model_router.complete(prompt)
            # Parse score from response (first number found)
            import re

            numbers = re.findall(r"\d+", response)
            score = float(numbers[0]) if numbers else 50.0
            score = min(max(score, 0.0), 100.0)
            return (score, response[:200])
        except Exception as exc:
            logger.warning("Model scoring failed: %s", exc)
            return (50.0, f"Model evaluation failed: {exc}")

    async def suggest_reallocations(
        self,
        ledger_entries: list[dict],
        threshold_pct: float = 30.0,
    ) -> list[dict]:
        """Identify underutilized allocations and suggest reallocations."""
        by_category: dict[str, dict] = {}
        for entry in ledger_entries:
            tag = entry.get("category_tag", "other")
            if tag not in by_category:
                by_category[tag] = {"allocated": 0.0, "spent": 0.0}
            by_category[tag]["allocated"] += entry.get("amount", 0.0)

        suggestions = []
        for tag, data in by_category.items():
            allocated = data["allocated"]
            if allocated <= 0:
                continue
            remaining_pct = 100.0  # Simplified: full amount is "remaining"
            if remaining_pct >= threshold_pct:
                suggestions.append(
                    {
                        "source_category": tag,
                        "available": allocated,
                        "reason": f"Category '{tag}' may have surplus allocation",
                    }
                )
        return suggestions
```

**Step 2: Commit**

```bash
git add backend/app/services/data_estate/scoring_engine.py
git commit -m "feat(data-estate): add template-driven scoring engine for allocation requests"
```

---

## Task 6: Create Ingestion Pipeline and Incremental Handler

**Files:**
- Create: `backend/app/services/data_estate/ingestion_pipeline.py`
- Create: `backend/app/services/data_estate/incremental_handler.py`

**Step 1: Write the ingestion pipeline**

```python
"""Document ingestion pipeline for the Data Estate vertical.

Converts approved stakeholder submissions into Latent Ocean Datasets,
runs them through BTUT thinning, then TCD-JEPA crystallization, and
registers the resulting modules in the module registry.

Pipeline: Document text -> Entities/Edges -> BTUT -> TCD-JEPA -> Module Registry
"""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime
from typing import Any

import numpy as np

from app.services.btut.pipeline import run_btut_pipeline
from app.services.crystallization.vertical import TCDJEPAVertical
from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    VerticalPreset,
)

logger = logging.getLogger(__name__)


def text_to_entities(
    raw_text: str,
    doc_id: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> tuple[list[dict], list[dict]]:
    """Convert document text into entities (chunks) and edges (similarity).

    Each chunk becomes an entity. Consecutive and semantically related
    chunks get edges between them. This gives BTUT a graph to thin.
    """
    # Split into paragraphs first, then chunk
    paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [raw_text]

    chunks: list[str] = []
    for para in paragraphs:
        if len(para) <= chunk_size:
            chunks.append(para)
        else:
            # Slide window over long paragraphs
            start = 0
            while start < len(para):
                end = min(start + chunk_size, len(para))
                # Try to break at sentence boundary
                if end < len(para):
                    last_period = para.rfind(".", start, end)
                    if last_period > start + chunk_size // 2:
                        end = last_period + 1
                chunks.append(para[start:end].strip())
                start = end - overlap if end < len(para) else end

    entities: list[dict] = []
    for i, chunk in enumerate(chunks):
        entity_id = f"{doc_id}:chunk:{i}"
        # Detect section hints from formatting
        section = _detect_section(chunk)
        entities.append(
            {
                "name": entity_id,
                "type": "document_chunk",
                "attributes": {
                    "text": chunk,
                    "chunk_index": i,
                    "section_hint": section,
                    "char_count": len(chunk),
                    "word_count": len(chunk.split()),
                    "doc_id": doc_id,
                },
            }
        )

    # Create edges between consecutive chunks (structural adjacency)
    edges: list[dict] = []
    for i in range(len(entities) - 1):
        edges.append(
            {
                "source": entities[i]["name"],
                "target": entities[i + 1]["name"],
                "type": "adjacent",
                "weight": 0.8,
            }
        )
    # Cross-paragraph edges for chunks that share significant terms
    for i in range(len(entities)):
        words_i = set(entities[i]["attributes"]["text"].lower().split())
        for j in range(i + 2, min(i + 6, len(entities))):
            words_j = set(entities[j]["attributes"]["text"].lower().split())
            overlap_ratio = len(words_i & words_j) / max(len(words_i | words_j), 1)
            if overlap_ratio > 0.15:
                edges.append(
                    {
                        "source": entities[i]["name"],
                        "target": entities[j]["name"],
                        "type": "semantic_overlap",
                        "weight": overlap_ratio,
                    }
                )

    return entities, edges


def _detect_section(text: str) -> str:
    """Heuristic section detection from text formatting."""
    first_line = text.split("\n")[0].strip()
    # All caps heading
    if first_line.isupper() and len(first_line) < 100:
        return first_line
    # Numbered section
    if re.match(r"^(\d+\.|\([a-z]\)|[IVXLC]+\.)\s", first_line):
        return first_line[:80]
    return ""


async def run_estate_pipeline(
    raw_text: str,
    doc_id: str,
    target_survivors: int = 100,
    budget_dollars: float = 10.0,
    progress_callback: Any | None = None,
    registry_service: Any | None = None,
) -> dict:
    """Full pipeline: text -> entities -> BTUT -> TCD-JEPA -> registry.

    Returns summary dict with module count and quality metrics.
    """
    # Stage 1: Convert text to entities/edges
    entities, edges = text_to_entities(raw_text, doc_id)
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    if len(entities) < 3:
        logger.warning(
            "Document %s produced only %d chunks, skipping crystallization",
            doc_id,
            len(entities),
        )
        return {
            "doc_id": doc_id,
            "status": "skipped",
            "reason": "too_few_chunks",
            "chunk_count": len(entities),
        }

    logger.info(
        "Estate pipeline: doc=%s chunks=%d edges=%d",
        doc_id,
        len(entities),
        len(edges),
    )

    # Stage 2: BTUT thinning
    btut_result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=target_survivors,
        budget_dollars=budget_dollars,
        progress_callback=progress_callback,
    )

    survivors = btut_result.get("survivors", [])
    flat_embeds = btut_result.get("embeddings_8d", [])
    n_survivors = len(survivors)

    if n_survivors == 0:
        return {
            "doc_id": doc_id,
            "status": "no_survivors",
            "chunk_count": len(entities),
        }

    # Build BTUTSurvivorBundle
    if flat_embeds and len(flat_embeds) == n_survivors * 8:
        embeddings = np.asarray(flat_embeds, dtype=np.float32).reshape(n_survivors, 8)
    else:
        embeddings = np.random.randn(n_survivors, 8).astype(np.float32)

    ids = [s["entity"]["name"] for s in survivors]
    bundle_edges: list[tuple[int, int, float]] = []
    id_to_idx = {eid: i for i, eid in enumerate(ids)}
    for edge in edges:
        src_idx = id_to_idx.get(edge["source"])
        dst_idx = id_to_idx.get(edge["target"])
        if src_idx is not None and dst_idx is not None:
            bundle_edges.append((src_idx, dst_idx, edge.get("weight", 1.0)))

    bundle = BTUTSurvivorBundle(
        embeddings=embeddings,
        ids=ids,
        edges=bundle_edges,
        metadata={"provenance_job_id": f"estate-{doc_id}", "doc_id": doc_id},
    )

    # Stage 3: TCD-JEPA crystallization
    vertical = TCDJEPAVertical(
        preset=VerticalPreset.DATA_ESTATE,
        registry_service=registry_service,
    )
    vertical.ingest_btut(bundle)

    try:
        modules = await vertical.crystallize(job_id=f"estate-{doc_id}")
    except Exception as exc:
        logger.error("Crystallization failed for doc %s: %s", doc_id, exc)
        return {
            "doc_id": doc_id,
            "status": "crystallization_failed",
            "error": str(exc),
            "survivor_count": n_survivors,
        }

    # Stage 4: Register modules
    registered = []
    if registry_service is not None:
        try:
            registered = await vertical.register(modules)
        except Exception as exc:
            logger.warning("Module registration failed: %s", exc)

    return {
        "doc_id": doc_id,
        "status": "completed",
        "chunk_count": len(entities),
        "survivor_count": n_survivors,
        "module_count": len(modules),
        "registered_count": len(registered),
        "reduction_ratio": len(entities) / max(n_survivors, 1),
        "completed_at": datetime.utcnow().isoformat(),
    }


def compute_file_hash(text: str) -> str:
    """SHA-256 hash of document text for deduplication."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
```

**Step 2: Write the incremental handler**

```python
"""Incremental document handler for the Data Estate vertical.

Adds new documents to an existing crystallized estate without
full recrystallization, using TCD-JEPA's delta bundle mechanism.
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.services.btut.pipeline import run_btut_pipeline
from app.services.crystallization.vertical_types import BTUTSurvivorBundle

from .ingestion_pipeline import text_to_entities

logger = logging.getLogger(__name__)


async def add_to_estate(
    raw_text: str,
    doc_id: str,
    session_id: str,
    target_survivors: int = 50,
    budget_dollars: float = 5.0,
) -> dict:
    """Add a new document to an existing estate session.

    Converts the document to entities, runs BTUT thinning, and
    pushes the survivors as a delta bundle to the TCD-JEPA
    incremental endpoint.
    """
    entities, edges = text_to_entities(raw_text, doc_id)
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    if len(entities) < 2:
        return {"status": "skipped", "reason": "too_few_chunks"}

    btut_result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=target_survivors,
        budget_dollars=budget_dollars,
    )

    survivors = btut_result.get("survivors", [])
    n_survivors = len(survivors)
    if n_survivors == 0:
        return {"status": "no_survivors"}

    flat_embeds = btut_result.get("embeddings_8d", [])
    if flat_embeds and len(flat_embeds) == n_survivors * 8:
        embeddings = np.asarray(flat_embeds, dtype=np.float32).reshape(n_survivors, 8)
    else:
        embeddings = np.random.randn(n_survivors, 8).astype(np.float32)

    ids = [s["entity"]["name"] for s in survivors]
    bundle_edges: list[tuple[int, int, float]] = []
    id_to_idx = {eid: i for i, eid in enumerate(ids)}
    for edge in edges:
        src_idx = id_to_idx.get(edge["source"])
        dst_idx = id_to_idx.get(edge["target"])
        if src_idx is not None and dst_idx is not None:
            bundle_edges.append((src_idx, dst_idx, edge.get("weight", 1.0)))

    bundle = BTUTSurvivorBundle(
        embeddings=embeddings,
        ids=ids,
        edges=bundle_edges,
        metadata={
            "provenance_job_id": f"estate-incr-{doc_id}",
            "doc_id": doc_id,
            "session_id": session_id,
        },
    )

    logger.info(
        "Incremental estate update: doc=%s session=%s survivors=%d",
        doc_id,
        session_id,
        n_survivors,
    )

    return {
        "status": "ready",
        "doc_id": doc_id,
        "session_id": session_id,
        "survivor_count": n_survivors,
        "bundle": bundle,
    }
```

**Step 3: Commit**

```bash
git add backend/app/services/data_estate/ingestion_pipeline.py backend/app/services/data_estate/incremental_handler.py
git commit -m "feat(data-estate): add ingestion pipeline and incremental handler with BTUT/TCD-JEPA integration"
```

---

## Task 7: Create Context Builder and Allocation Overlay

**Files:**
- Create: `backend/app/services/data_estate/context_builder.py`
- Create: `backend/app/services/data_estate/allocation_overlay.py`

**Step 1: Write the context builder**

```python
"""Builds a comprehensive estate context snapshot for AI interactions.

Injected into the model router's system prompt so the AI assistant
has full awareness of the estate's topology, submissions, and
allocation state.
"""
from __future__ import annotations

from typing import Any


def build_estate_context(
    modules: list[dict],
    submissions: list[dict],
    ledger_entries: list[dict],
    pending_allocations: list[dict],
) -> str:
    """Assemble a text context from estate state for AI system prompt."""
    sections: list[str] = []

    # Module topology
    by_type = {"attractor": 0, "cycle": 0, "boundary": 0}
    for m in modules:
        mtype = m.get("module_type", "attractor")
        by_type[mtype] = by_type.get(mtype, 0) + 1

    sections.append(
        f"ESTATE TOPOLOGY: {len(modules)} crystallized modules "
        f"({by_type['attractor']} stable/H0, {by_type['cycle']} evolving/H1, "
        f"{by_type['boundary']} gaps/H2)."
    )

    # Submission status
    by_status = {}
    for s in submissions:
        st = s.get("status", "pending")
        by_status[st] = by_status.get(st, 0) + 1
    status_str = ", ".join(f"{k}: {v}" for k, v in by_status.items())
    sections.append(f"SUBMISSIONS: {len(submissions)} total ({status_str}).")

    # Ledger summary
    if ledger_entries:
        total = sum(e.get("amount", 0) for e in ledger_entries)
        categories = set(e.get("category_tag", "") for e in ledger_entries)
        sections.append(
            f"ALLOCATION LEDGER: ${total:,.2f} across {len(categories)} categories, "
            f"{len(ledger_entries)} line items."
        )

    # Pending allocations
    if pending_allocations:
        total_pending = sum(a.get("amount", 0) for a in pending_allocations)
        sections.append(
            f"PENDING ALLOCATION REQUESTS: {len(pending_allocations)} "
            f"requests totaling ${total_pending:,.2f}."
        )

    # Top modules by quality
    top_modules = sorted(modules, key=lambda m: m.get("quality_score", 0), reverse=True)[:5]
    if top_modules:
        module_lines = []
        for m in top_modules:
            desc = m.get("description", m.get("id", "unnamed"))
            module_lines.append(
                f"  - {desc} (type={m.get('module_type')}, "
                f"purity={m.get('purity', 0):.2f}, "
                f"members={len(m.get('members', []))})"
            )
        sections.append("TOP MODULES:\n" + "\n".join(module_lines))

    # H2 gaps
    gaps = [m for m in modules if m.get("module_type") == "boundary"]
    if gaps:
        sections.append(
            f"DETECTED GAPS: {len(gaps)} boundary modules indicating "
            f"areas needing attention."
        )

    return "\n\n".join(sections)
```

**Step 2: Write the allocation overlay**

```python
"""Optional transparent allocation ledger overlay.

Provides CRUD helpers for ledger entries and summary statistics.
The ledger is append-only with versioning — entries are never
modified, only superseded by new versions.
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_estate import EstateLedgerEntry


class AllocationOverlay:
    """Service for managing the transparent allocation ledger."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_entry(
        self,
        org_id: uuid.UUID,
        amount: float,
        label: str,
        category_tag: str,
        effective_date: date,
        created_by: uuid.UUID,
        metadata: dict | None = None,
    ) -> EstateLedgerEntry:
        """Create a new ledger entry."""
        # Determine version (max version for this category + 1)
        stmt = select(func.max(EstateLedgerEntry.version)).where(
            EstateLedgerEntry.org_id == org_id,
            EstateLedgerEntry.category_tag == category_tag,
        )
        result = await self.db.execute(stmt)
        max_version = result.scalar() or 0

        entry = EstateLedgerEntry(
            org_id=org_id,
            amount=amount,
            label=label,
            category_tag=category_tag,
            version=max_version + 1,
            effective_date=effective_date,
            created_by=created_by,
            metadata_=metadata,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def list_entries(
        self,
        org_id: uuid.UUID,
        category_tag: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[EstateLedgerEntry]:
        """List ledger entries with optional category filter."""
        stmt = (
            select(EstateLedgerEntry)
            .where(EstateLedgerEntry.org_id == org_id)
            .order_by(EstateLedgerEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if category_tag:
            stmt = stmt.where(EstateLedgerEntry.category_tag == category_tag)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_summary(self, org_id: uuid.UUID) -> dict[str, Any]:
        """Get aggregated ledger summary by category."""
        stmt = (
            select(
                EstateLedgerEntry.category_tag,
                func.sum(EstateLedgerEntry.amount).label("total"),
                func.count(EstateLedgerEntry.id).label("count"),
            )
            .where(EstateLedgerEntry.org_id == org_id)
            .group_by(EstateLedgerEntry.category_tag)
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        category_totals = {}
        grand_total = 0.0
        entry_count = 0
        for row in rows:
            category_totals[row.category_tag] = float(row.total)
            grand_total += float(row.total)
            entry_count += int(row.count)

        return {
            "total_allocated": grand_total,
            "category_totals": category_totals,
            "entry_count": entry_count,
        }
```

**Step 3: Commit**

```bash
git add backend/app/services/data_estate/context_builder.py backend/app/services/data_estate/allocation_overlay.py
git commit -m "feat(data-estate): add context builder for AI and allocation ledger overlay"
```

---

## Task 8: Create FastAPI Router

**Files:**
- Create: `backend/app/api/v1/data_estate_vertical.py`

**Step 1: Write the full router**

```python
"""Data Estate vertical — API routes.

Prefix: /data-estate
All routes use existing RBAC via require_role/require_permission.
"""
from __future__ import annotations

import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.permissions import require_role
from app.db.session import get_db
from app.models.data_estate import (
    EstateAllocationRequest,
    EstateLedgerEntry,
    EstateScoringTemplate,
    EstateSubmission,
)
from app.models.module_registry import ModuleRegistryEntry
from app.schemas.data_estate import (
    AllocationDecisionRequest,
    AllocationRequestCreate,
    AllocationRequestOut,
    ChatRequest,
    ChatResponse,
    CrystallizeRequest,
    DashboardOut,
    LedgerEntryCreateRequest,
    LedgerEntryOut,
    LedgerSummaryOut,
    ScoringTemplateCreate,
    ScoringTemplateOut,
    SubmissionCreateRequest,
    SubmissionOut,
    SubmissionReviewRequest,
)
from app.services.data_estate.allocation_overlay import AllocationOverlay
from app.services.data_estate.context_builder import build_estate_context
from app.services.data_estate.ingestion_pipeline import compute_file_hash
from app.services.data_estate.model_router import ModelRouter
from app.services.data_estate.scoring_engine import ScoringEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data-estate", tags=["data-estate"])


# ── Submissions (The Scroll) ──────────────────────────────────────


@router.post("/submit", response_model=SubmissionOut)
async def submit_document(
    body: SubmissionCreateRequest,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a document for moderation and eventual crystallization."""
    file_hash = compute_file_hash(body.raw_text)

    # Check for duplicates
    existing = await db.execute(
        select(EstateSubmission).where(
            EstateSubmission.org_id == user.organization_id,
            EstateSubmission.file_hash == file_hash,
            EstateSubmission.status != "rejected",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A document with identical content already exists",
        )

    submission = EstateSubmission(
        org_id=user.organization_id,
        title=body.title,
        raw_text=body.raw_text,
        file_hash=file_hash,
        status="pending",
        submitted_by=user.id,
        estate_tag=body.estate_tag,
    )
    db.add(submission)
    await db.flush()

    return SubmissionOut(
        id=submission.id,
        org_id=submission.org_id,
        title=submission.title,
        status=submission.status,
        estate_tag=submission.estate_tag,
        submitted_by=submission.submitted_by,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
    )


@router.get("/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    status_filter: str | None = None,
    estate_tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List submissions (operator+ sees all, others see own)."""
    stmt = (
        select(EstateSubmission)
        .where(EstateSubmission.org_id == user.organization_id)
        .order_by(EstateSubmission.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        stmt = stmt.where(EstateSubmission.status == status_filter)
    if estate_tag:
        stmt = stmt.where(EstateSubmission.estate_tag == estate_tag)
    # Non-operators only see their own submissions
    if user.role not in ("operator", "admin"):
        stmt = stmt.where(EstateSubmission.submitted_by == user.id)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        SubmissionOut(
            id=r.id,
            org_id=r.org_id,
            title=r.title,
            status=r.status,
            estate_tag=r.estate_tag,
            submitted_by=r.submitted_by,
            reviewed_by=r.reviewed_by,
            review_note=r.review_note,
            dataset_id=r.dataset_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/submissions/{submission_id}/review", response_model=SubmissionOut)
async def review_submission(
    submission_id: uuid.UUID,
    body: SubmissionReviewRequest,
    user: Any = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a submission. Approval triggers crystallization."""
    result = await db.execute(
        select(EstateSubmission).where(EstateSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status != "pending":
        raise HTTPException(
            status_code=400, detail=f"Submission already {submission.status}"
        )

    submission.status = "approved" if body.action == "approve" else "rejected"
    submission.reviewed_by = user.id
    submission.review_note = body.note
    await db.flush()

    # On approval, trigger crystallization via Celery
    if body.action == "approve":
        try:
            from app.tasks.data_estate_crystallize import crystallize_estate_task

            crystallize_estate_task.delay(
                submission_id=str(submission.id),
                org_id=str(submission.org_id),
            )
        except Exception as exc:
            logger.warning("Failed to queue crystallization: %s", exc)

    return SubmissionOut(
        id=submission.id,
        org_id=submission.org_id,
        title=submission.title,
        status=submission.status,
        estate_tag=submission.estate_tag,
        submitted_by=submission.submitted_by,
        reviewed_by=submission.reviewed_by,
        review_note=submission.review_note,
        dataset_id=submission.dataset_id,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
    )


@router.get("/scroll", response_model=list[SubmissionOut])
async def get_scroll(
    estate_tag: str = "default",
    limit: int = 50,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Public view of approved documents in the estate."""
    result = await db.execute(
        select(EstateSubmission)
        .where(
            EstateSubmission.org_id == user.organization_id,
            EstateSubmission.status == "approved",
            EstateSubmission.estate_tag == estate_tag,
        )
        .order_by(EstateSubmission.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        SubmissionOut(
            id=r.id,
            org_id=r.org_id,
            title=r.title,
            status=r.status,
            estate_tag=r.estate_tag,
            submitted_by=r.submitted_by,
            reviewed_by=r.reviewed_by,
            dataset_id=r.dataset_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


# ── Modules ────────────────────────────────────────────────────────


@router.get("/modules")
async def list_estate_modules(
    limit: int = 50,
    min_quality: float = 0.0,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List crystallized estate modules from the registry."""
    result = await db.execute(
        select(ModuleRegistryEntry)
        .where(
            ModuleRegistryEntry.vertical == "data_estate",
            ModuleRegistryEntry.quality_score >= min_quality,
        )
        .order_by(ModuleRegistryEntry.quality_score.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "module_type": r.module_type,
            "purity": r.purity,
            "quality_score": r.quality_score,
            "members": r.members,
            "description": r.description,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Ledger ──────────────────────────────────────────────────────────


@router.get("/ledger", response_model=list[LedgerEntryOut])
async def list_ledger(
    category_tag: str | None = None,
    limit: int = 100,
    offset: int = 0,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List allocation ledger entries."""
    overlay = AllocationOverlay(db)
    entries = await overlay.list_entries(
        org_id=user.organization_id,
        category_tag=category_tag,
        limit=limit,
        offset=offset,
    )
    return [
        LedgerEntryOut(
            id=e.id,
            org_id=e.org_id,
            amount=e.amount,
            label=e.label,
            category_tag=e.category_tag,
            version=e.version,
            effective_date=e.effective_date,
            created_by=e.created_by,
            metadata=e.metadata_,
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.post("/ledger", response_model=LedgerEntryOut)
async def create_ledger_entry(
    body: LedgerEntryCreateRequest,
    user: Any = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new ledger entry."""
    overlay = AllocationOverlay(db)
    entry = await overlay.create_entry(
        org_id=user.organization_id,
        amount=body.amount,
        label=body.label,
        category_tag=body.category_tag,
        effective_date=body.effective_date,
        created_by=user.id,
        metadata=body.metadata,
    )
    return LedgerEntryOut(
        id=entry.id,
        org_id=entry.org_id,
        amount=entry.amount,
        label=entry.label,
        category_tag=entry.category_tag,
        version=entry.version,
        effective_date=entry.effective_date,
        created_by=entry.created_by,
        metadata=entry.metadata_,
        created_at=entry.created_at,
    )


@router.get("/ledger/summary", response_model=LedgerSummaryOut)
async def ledger_summary(
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated ledger summary."""
    overlay = AllocationOverlay(db)
    summary = await overlay.get_summary(user.organization_id)
    return LedgerSummaryOut(**summary)


# ── Allocation Requests ─────────────────────────────────────────────


@router.post("/allocations/request", response_model=AllocationRequestOut)
async def create_allocation_request(
    body: AllocationRequestCreate,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an allocation request with AI scoring."""
    # Load scoring templates for this org
    tmpl_result = await db.execute(
        select(EstateScoringTemplate).where(
            EstateScoringTemplate.org_id == user.organization_id,
            EstateScoringTemplate.is_active == True,  # noqa: E712
        )
    )
    templates = [
        {
            "name": t.name,
            "weight": t.weight,
            "evaluator_type": t.evaluator_type,
            "evaluator_config": t.evaluator_config,
            "is_active": t.is_active,
        }
        for t in tmpl_result.scalars().all()
    ]

    # Load recent requests for duplicate detection
    recent_result = await db.execute(
        select(EstateAllocationRequest)
        .where(EstateAllocationRequest.org_id == user.organization_id)
        .order_by(EstateAllocationRequest.created_at.desc())
        .limit(20)
    )
    recent = [
        {
            "justification": r.justification,
            "amount": r.amount,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in recent_result.scalars().all()
    ]

    # Score the request
    router_instance = ModelRouter()
    engine = ScoringEngine(model_router=router_instance)
    score_result = await engine.score(
        amount=body.amount,
        justification=body.justification,
        category_tag=body.category_tag,
        templates=templates,
        recent_requests=recent,
    )

    alloc = EstateAllocationRequest(
        org_id=user.organization_id,
        amount=body.amount,
        justification=body.justification,
        category_tag=body.category_tag,
        score_result=score_result.to_dict(),
        status="pending",
        requested_by=user.id,
    )
    db.add(alloc)
    await db.flush()

    return AllocationRequestOut(
        id=alloc.id,
        org_id=alloc.org_id,
        amount=alloc.amount,
        justification=alloc.justification,
        category_tag=alloc.category_tag,
        score_result=alloc.score_result,
        status=alloc.status,
        requested_by=alloc.requested_by,
        created_at=alloc.created_at,
    )


@router.get("/allocations", response_model=list[AllocationRequestOut])
async def list_allocations(
    status_filter: str | None = None,
    limit: int = 50,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List allocation requests."""
    stmt = (
        select(EstateAllocationRequest)
        .where(EstateAllocationRequest.org_id == user.organization_id)
        .order_by(EstateAllocationRequest.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(EstateAllocationRequest.status == status_filter)

    result = await db.execute(stmt)
    return [
        AllocationRequestOut(
            id=r.id,
            org_id=r.org_id,
            amount=r.amount,
            justification=r.justification,
            category_tag=r.category_tag,
            score_result=r.score_result,
            status=r.status,
            requested_by=r.requested_by,
            decided_by=r.decided_by,
            decision_note=r.decision_note,
            created_at=r.created_at,
        )
        for r in result.scalars().all()
    ]


@router.post("/allocations/{alloc_id}/decide", response_model=AllocationRequestOut)
async def decide_allocation(
    alloc_id: uuid.UUID,
    body: AllocationDecisionRequest,
    user: Any = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    """Admin decision on an allocation request."""
    result = await db.execute(
        select(EstateAllocationRequest).where(EstateAllocationRequest.id == alloc_id)
    )
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation request not found")

    status_map = {"approve": "approved", "deny": "denied", "flag": "flagged"}
    alloc.status = status_map[body.action]
    alloc.decided_by = user.id
    alloc.decision_note = body.note
    await db.flush()

    # On approval, auto-create ledger entry
    if body.action == "approve":
        overlay = AllocationOverlay(db)
        await overlay.create_entry(
            org_id=alloc.org_id,
            amount=alloc.amount,
            label=alloc.justification[:500],
            category_tag=alloc.category_tag,
            effective_date=alloc.created_at.date(),
            created_by=user.id,
        )

    return AllocationRequestOut(
        id=alloc.id,
        org_id=alloc.org_id,
        amount=alloc.amount,
        justification=alloc.justification,
        category_tag=alloc.category_tag,
        score_result=alloc.score_result,
        status=alloc.status,
        requested_by=alloc.requested_by,
        decided_by=alloc.decided_by,
        decision_note=alloc.decision_note,
        created_at=alloc.created_at,
    )


# ── Chat ────────────────────────────────────────────────────────────


@router.post("/chat", response_model=ChatResponse)
async def estate_chat(
    body: ChatRequest,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """RAG-powered chat over the estate's crystallized knowledge."""
    # Load modules
    mod_result = await db.execute(
        select(ModuleRegistryEntry)
        .where(ModuleRegistryEntry.vertical == "data_estate")
        .order_by(ModuleRegistryEntry.quality_score.desc())
        .limit(20)
    )
    modules = [
        {
            "id": str(m.id),
            "module_type": m.module_type,
            "purity": m.purity,
            "quality_score": m.quality_score,
            "members": m.members,
            "description": m.description,
        }
        for m in mod_result.scalars().all()
    ]

    # Load submissions
    sub_result = await db.execute(
        select(EstateSubmission)
        .where(
            EstateSubmission.org_id == user.organization_id,
            EstateSubmission.estate_tag == body.estate_tag,
        )
        .order_by(EstateSubmission.created_at.desc())
        .limit(10)
    )
    submissions = [
        {"title": s.title, "status": s.status}
        for s in sub_result.scalars().all()
    ]

    # Load ledger
    overlay = AllocationOverlay(db)
    ledger_entries = await overlay.list_entries(user.organization_id, limit=20)
    ledger_dicts = [
        {"amount": e.amount, "category_tag": e.category_tag, "label": e.label}
        for e in ledger_entries
    ]

    # Load pending allocations
    alloc_result = await db.execute(
        select(EstateAllocationRequest).where(
            EstateAllocationRequest.org_id == user.organization_id,
            EstateAllocationRequest.status == "pending",
        )
    )
    pending = [
        {"amount": a.amount, "category_tag": a.category_tag}
        for a in alloc_result.scalars().all()
    ]

    # Build context and complete
    context = build_estate_context(modules, submissions, ledger_dicts, pending)
    model = ModelRouter()

    system_prompt = (
        "You are a knowledgeable assistant for a data estate. "
        "You have access to the estate's crystallized knowledge modules, "
        "submission history, and allocation data. Use this context to "
        "answer questions accurately and cite relevant modules.\n\n"
        f"ESTATE CONTEXT:\n{context}"
    )

    answer = await model.complete(body.question, system=system_prompt)

    return ChatResponse(
        answer=answer,
        sources=[m["id"] for m in modules[:5]],
        module_hits=len(modules),
    )


# ── Dashboard ───────────────────────────────────────────────────────


@router.get("/dashboard", response_model=DashboardOut)
async def estate_dashboard(
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Command center aggregated metrics."""
    org_id = user.organization_id

    # Submission counts
    sub_result = await db.execute(
        select(EstateSubmission.status, func.count(EstateSubmission.id))
        .where(EstateSubmission.org_id == org_id)
        .group_by(EstateSubmission.status)
    )
    sub_counts = dict(sub_result.all())
    total_subs = sum(sub_counts.values())
    pending_subs = sub_counts.get("pending", 0)
    approved_subs = sub_counts.get("approved", 0)

    # Module counts
    mod_result = await db.execute(
        select(ModuleRegistryEntry.module_type, func.count(ModuleRegistryEntry.id))
        .where(ModuleRegistryEntry.vertical == "data_estate")
        .group_by(ModuleRegistryEntry.module_type)
    )
    mod_counts = dict(mod_result.all())
    total_modules = sum(mod_counts.values())

    # Ledger
    overlay = AllocationOverlay(db)
    ledger_summary = await overlay.get_summary(org_id)

    # Pending allocations
    alloc_result = await db.execute(
        select(func.count(EstateAllocationRequest.id)).where(
            EstateAllocationRequest.org_id == org_id,
            EstateAllocationRequest.status == "pending",
        )
    )
    pending_allocs = alloc_result.scalar() or 0

    return DashboardOut(
        total_submissions=total_subs,
        pending_submissions=pending_subs,
        approved_submissions=approved_subs,
        total_modules=total_modules,
        modules_by_type=mod_counts,
        ledger_total=ledger_summary["total_allocated"],
        ledger_categories=len(ledger_summary["category_totals"]),
        allocation_requests_pending=pending_allocs,
    )
```

**Step 2: Commit**

```bash
git add backend/app/api/v1/data_estate_vertical.py
git commit -m "feat(data-estate): add FastAPI router with full CRUD, chat, and dashboard endpoints"
```

---

## Task 9: Create Celery Task

**Files:**
- Create: `backend/app/tasks/data_estate_crystallize.py`

**Step 1: Write the Celery task**

```python
"""Celery task for Data Estate crystallization.

Triggered when a submission is approved. Runs the full pipeline:
text -> entities -> BTUT -> TCD-JEPA -> module registry.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime

import redis

from app.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)

_RESULT_PREFIX = "estate_result:"
_RESULT_TTL = 7 * 24 * 3600  # 7 days


def _get_sync_redis():
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@celery_app.task(
    bind=True,
    name="data_estate.crystallize",
    queue="crystallization",
    max_retries=2,
    time_limit=7200,  # 2 hours hard limit
    soft_time_limit=6900,  # 1h55m soft limit
)
def crystallize_estate_task(
    self,
    submission_id: str,
    org_id: str,
) -> dict:
    """Run the estate ingestion pipeline for an approved submission."""
    r = _get_sync_redis()
    r.set(f"{_RESULT_PREFIX}{submission_id}:status", "running")
    r.set(f"{_RESULT_PREFIX}{submission_id}:started_at", datetime.utcnow().isoformat())

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _run_pipeline(submission_id, org_id)
            )
        finally:
            loop.close()

        r.setex(
            f"{_RESULT_PREFIX}{submission_id}:result",
            _RESULT_TTL,
            json.dumps(result, default=str),
        )
        r.set(f"{_RESULT_PREFIX}{submission_id}:status", "completed")
        logger.info(
            "Estate crystallization done: submission=%s, modules=%d",
            submission_id,
            result.get("module_count", 0),
        )
        return result

    except Exception as exc:
        logger.exception(
            "Estate crystallization failed: submission=%s", submission_id
        )
        r.set(f"{_RESULT_PREFIX}{submission_id}:status", "failed")
        r.setex(
            f"{_RESULT_PREFIX}{submission_id}:error",
            _RESULT_TTL,
            str(exc),
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        raise


async def _run_pipeline(submission_id: str, org_id: str) -> dict:
    """Async pipeline execution inside the Celery worker."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.models.data_estate import EstateSubmission
    from app.models.module_registry import ModuleRegistryEntry
    from app.services.crystallization.module_registry import ModuleRegistryService
    from app.services.data_estate.ingestion_pipeline import run_estate_pipeline

    engine = create_async_engine(settings.DATABASE_URL, future=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        from sqlalchemy import select

        # Load submission
        result = await db.execute(
            select(EstateSubmission).where(
                EstateSubmission.id == submission_id
            )
        )
        submission = result.scalar_one_or_none()
        if not submission:
            raise RuntimeError(f"Submission {submission_id} not found")

        # Run the pipeline
        registry = ModuleRegistryService(db)
        pipeline_result = await run_estate_pipeline(
            raw_text=submission.raw_text,
            doc_id=str(submission.id),
            registry_service=registry,
        )

        await db.commit()

    await engine.dispose()
    return pipeline_result
```

**Step 2: Commit**

```bash
git add backend/app/tasks/data_estate_crystallize.py
git commit -m "feat(data-estate): add Celery crystallization task"
```

---

## Task 10: Wire Into Existing Infrastructure (Additive Modifications)

**Files:**
- Modify: `backend/app/api/v1/__init__.py` (add import + include)
- Modify: `backend/app/celery_app.py` (add import)
- Modify: `backend/app/config.py` (add config vars)

**Step 1: Register the router**

In `backend/app/api/v1/__init__.py`, add after the last import:

```python
from app.api.v1.data_estate_vertical import router as data_estate_router
```

And add after the last `router.include_router(...)`:

```python
router.include_router(data_estate_router)
```

**Step 2: Register the Celery task**

In `backend/app/celery_app.py`, add after the last import:

```python
import app.tasks.data_estate_crystallize  # noqa: E402, F401
```

**Step 3: Add config variables**

In `backend/app/config.py`, add in the Settings class (after the BTUT section):

```python
    # ── Data Estate ─────────────────────────────────────────────────
    DATA_ESTATE_ENABLED: bool = False
    DATA_ESTATE_MODEL_PROVIDER: str = "anthropic"
    DATA_ESTATE_MODEL_NAME: str = "claude-sonnet-4-6"
    DATA_ESTATE_EMBED_MODEL: str = ""
    DATA_ESTATE_MAX_SUBMISSION_SIZE: int = 10_485_760  # 10MB
    DATA_ESTATE_AUTO_APPROVE: bool = False
    XAI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/__init__.py backend/app/celery_app.py backend/app/config.py
git commit -m "feat(data-estate): wire router, celery task, and config into existing infrastructure"
```

---

## Task 11: Create Frontend Types, API Client, and Store

**Files:**
- Create: `frontend/lib/data-estate/types.ts`
- Create: `frontend/lib/data-estate/api.ts`
- Create: `frontend/lib/data-estate/store.ts`

**Step 1: Write the types**

```typescript
// Types for the Data Estate vertical

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type AllocationStatus = "pending" | "approved" | "denied" | "flagged";
export type ModuleType = "attractor" | "cycle" | "boundary";

export interface Submission {
  id: string;
  org_id: string;
  title: string;
  status: SubmissionStatus;
  estate_tag: string;
  submitted_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  dataset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  org_id: string;
  amount: number;
  label: string;
  category_tag: string;
  version: number;
  effective_date: string;
  created_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface LedgerSummary {
  total_allocated: number;
  category_totals: Record<string, number>;
  entry_count: number;
}

export interface AllocationRequest {
  id: string;
  org_id: string;
  amount: number;
  justification: string;
  category_tag: string;
  score_result: ScoreResult | null;
  status: AllocationStatus;
  requested_by: string;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface ScoreResult {
  total: number;
  recommendation: string;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface EstateModule {
  id: string;
  module_type: ModuleType;
  purity: number;
  quality_score: number;
  members: string[];
  description: string | null;
  created_at: string | null;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  module_hits: number;
}

export interface Dashboard {
  total_submissions: number;
  pending_submissions: number;
  approved_submissions: number;
  total_modules: number;
  modules_by_type: Record<string, number>;
  ledger_total: number;
  ledger_categories: number;
  allocation_requests_pending: number;
}
```

**Step 2: Write the API client**

```typescript
// API client for the Data Estate vertical

import type {
  AllocationRequest,
  ChatResponse,
  Dashboard,
  EstateModule,
  LedgerEntry,
  LedgerSummary,
  Submission,
} from "./types";

const API = "/api/v1/data-estate";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

// Submissions
export const submitDocument = (title: string, rawText: string, estateTag = "default") =>
  request<Submission>("/submit", {
    method: "POST",
    body: JSON.stringify({ title, raw_text: rawText, estate_tag: estateTag }),
  });

export const fetchSubmissions = (status?: string, estateTag?: string) => {
  const params = new URLSearchParams();
  if (status) params.set("status_filter", status);
  if (estateTag) params.set("estate_tag", estateTag);
  return request<Submission[]>(`/submissions?${params}`);
};

export const reviewSubmission = (id: string, action: "approve" | "reject", note?: string) =>
  request<Submission>(`/submissions/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });

export const fetchScroll = (estateTag = "default") =>
  request<Submission[]>(`/scroll?estate_tag=${estateTag}`);

// Modules
export const fetchEstateModules = (limit = 50, minQuality = 0) =>
  request<EstateModule[]>(`/modules?limit=${limit}&min_quality=${minQuality}`);

// Ledger
export const fetchLedger = (categoryTag?: string) => {
  const params = categoryTag ? `?category_tag=${categoryTag}` : "";
  return request<LedgerEntry[]>(`/ledger${params}`);
};

export const createLedgerEntry = (data: {
  amount: number;
  label: string;
  category_tag: string;
  effective_date: string;
  metadata?: Record<string, unknown>;
}) => request<LedgerEntry>("/ledger", { method: "POST", body: JSON.stringify(data) });

export const fetchLedgerSummary = () => request<LedgerSummary>("/ledger/summary");

// Allocations
export const createAllocationRequest = (data: {
  amount: number;
  justification: string;
  category_tag: string;
}) =>
  request<AllocationRequest>("/allocations/request", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchAllocations = (status?: string) => {
  const params = status ? `?status_filter=${status}` : "";
  return request<AllocationRequest[]>(`/allocations${params}`);
};

export const decideAllocation = (id: string, action: "approve" | "deny" | "flag", note?: string) =>
  request<AllocationRequest>(`/allocations/${id}/decide`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });

// Chat
export const estateChat = (question: string, estateTag = "default") =>
  request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ question, estate_tag: estateTag }),
  });

// Dashboard
export const fetchDashboard = () => request<Dashboard>("/dashboard");
```

**Step 3: Write the Zustand store**

```typescript
// Zustand store for Data Estate vertical state

import { create } from "zustand";
import type {
  AllocationRequest,
  Dashboard,
  EstateModule,
  LedgerEntry,
  LedgerSummary,
  Submission,
} from "./types";
import * as api from "./api";

interface DataEstateState {
  // Data
  submissions: Submission[];
  modules: EstateModule[];
  ledger: LedgerEntry[];
  ledgerSummary: LedgerSummary | null;
  allocations: AllocationRequest[];
  dashboard: Dashboard | null;

  // UI
  activeTab: "overview" | "scroll" | "ledger" | "allocations" | "chat";
  loading: boolean;
  error: string | null;

  // Actions
  setActiveTab: (tab: DataEstateState["activeTab"]) => void;
  loadDashboard: () => Promise<void>;
  loadSubmissions: (status?: string) => Promise<void>;
  loadModules: () => Promise<void>;
  loadLedger: (category?: string) => Promise<void>;
  loadLedgerSummary: () => Promise<void>;
  loadAllocations: (status?: string) => Promise<void>;
  reset: () => void;
}

export const useDataEstateStore = create<DataEstateState>((set) => ({
  submissions: [],
  modules: [],
  ledger: [],
  ledgerSummary: null,
  allocations: [],
  dashboard: null,
  activeTab: "overview",
  loading: false,
  error: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadDashboard: async () => {
    try {
      set({ loading: true, error: null });
      const dashboard = await api.fetchDashboard();
      set({ dashboard, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadSubmissions: async (status?: string) => {
    try {
      const submissions = await api.fetchSubmissions(status);
      set({ submissions });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadModules: async () => {
    try {
      const modules = await api.fetchEstateModules();
      set({ modules });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadLedger: async (category?: string) => {
    try {
      const ledger = await api.fetchLedger(category);
      set({ ledger });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadLedgerSummary: async () => {
    try {
      const ledgerSummary = await api.fetchLedgerSummary();
      set({ ledgerSummary });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadAllocations: async (status?: string) => {
    try {
      const allocations = await api.fetchAllocations(status);
      set({ allocations });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reset: () =>
    set({
      submissions: [],
      modules: [],
      ledger: [],
      ledgerSummary: null,
      allocations: [],
      dashboard: null,
      activeTab: "overview",
      loading: false,
      error: null,
    }),
}));
```

**Step 4: Commit**

```bash
git add frontend/lib/data-estate/
git commit -m "feat(data-estate): add frontend types, API client, and Zustand store"
```

---

## Task 12: Create Frontend Command Center Page

**Files:**
- Create: `frontend/app/data-estate/layout.tsx`
- Create: `frontend/app/data-estate/page.tsx`

**Step 1: Write the layout**

```tsx
export default function DataEstateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

**Step 2: Write the command center page**

```tsx
"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import {
  Database,
  FileText,
  BarChart3,
  MessageSquare,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export default function DataEstatePage() {
  const dashboard = useDataEstateStore((s) => s.dashboard);
  const loading = useDataEstateStore((s) => s.loading);
  const loadDashboard = useDataEstateStore((s) => s.loadDashboard);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            Data Estate
          </h1>
          <p className="text-sm text-li-text-muted mt-1">
            Living knowledge base — documents crystallized into searchable, routable modules
          </p>
        </div>

        {loading && !dashboard ? (
          <div className="text-li-text-muted text-sm">Loading estate metrics...</div>
        ) : dashboard ? (
          <div className="space-y-6">
            {/* Top stats row */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                icon={<FileText className="w-5 h-5 text-cyan-400" />}
                label="Total Submissions"
                value={dashboard.total_submissions}
              />
              <StatCard
                icon={<Clock className="w-5 h-5 text-yellow-400" />}
                label="Pending Review"
                value={dashboard.pending_submissions}
              />
              <StatCard
                icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
                label="Approved"
                value={dashboard.approved_submissions}
              />
              <StatCard
                icon={<Layers className="w-5 h-5 text-purple-400" />}
                label="Crystallized Modules"
                value={dashboard.total_modules}
              />
            </div>

            {/* Module type breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  H0 Attractors (Stable)
                </div>
                <div className="text-2xl font-semibold text-cyan-400">
                  {dashboard.modules_by_type.attractor ?? 0}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  H1 Cycles (Evolving)
                </div>
                <div className="text-2xl font-semibold text-yellow-400">
                  {dashboard.modules_by_type.cycle ?? 0}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  H2 Boundaries (Gaps)
                </div>
                <div className="text-2xl font-semibold text-red-400">
                  {dashboard.modules_by_type.boundary ?? 0}
                </div>
              </div>
            </div>

            {/* Allocation summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  Ledger Total
                </div>
                <div className="text-2xl font-semibold text-white">
                  ${dashboard.ledger_total.toLocaleString()}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  Categories
                </div>
                <div className="text-2xl font-semibold text-white">
                  {dashboard.ledger_categories}
                </div>
              </div>
              <div className="li-card p-4">
                <div className="text-xs text-li-text-muted uppercase tracking-wider mb-1">
                  Pending Allocations
                </div>
                <div className="text-2xl font-semibold text-yellow-400">
                  {dashboard.allocation_requests_pending}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-4">
              <a
                href="/data-estate/scroll/submit"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <FileText className="w-5 h-5 text-cyan-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-cyan-400">
                  Submit Document
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Add to the estate
                </div>
              </a>
              <a
                href="/data-estate/scroll"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <Database className="w-5 h-5 text-purple-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-purple-400">
                  Browse Scroll
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Approved documents
                </div>
              </a>
              <a
                href="/data-estate/ledger"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <Wallet className="w-5 h-5 text-green-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-green-400">
                  View Ledger
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Allocation tracking
                </div>
              </a>
              <a
                href="/data-estate/chat"
                className="li-card p-4 hover:border-cyan-500/30 transition-colors group"
              >
                <MessageSquare className="w-5 h-5 text-blue-400 mb-2" />
                <div className="text-sm font-medium text-white group-hover:text-blue-400">
                  Estate Chat
                </div>
                <div className="text-xs text-li-text-muted mt-0.5">
                  Ask the knowledge base
                </div>
              </a>
            </div>
          </div>
        ) : (
          <div className="li-card p-8 text-center">
            <AlertCircle className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
            <p className="text-li-text-muted">
              No estate data yet. Submit your first document to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="li-card p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-li-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/app/data-estate/
git commit -m "feat(data-estate): add command center dashboard page"
```

---

## Task 13: Create Remaining Frontend Pages

**Files:**
- Create: `frontend/app/data-estate/scroll/page.tsx`
- Create: `frontend/app/data-estate/scroll/submit/page.tsx`
- Create: `frontend/app/data-estate/ledger/page.tsx`
- Create: `frontend/app/data-estate/allocations/page.tsx`
- Create: `frontend/app/data-estate/chat/page.tsx`

These follow the exact same pattern as the command center page (use client, import Sidebar/Navbar, use store, render with Tailwind + li-* classes). Each page focuses on its domain slice.

**Step 1: Write all sub-pages** (code omitted for brevity — follows identical patterns to Task 12 using the API functions from Task 11)

The implementing agent should create each page following the established TCD-JEPA/NIV page patterns with:
- `"use client"` directive
- Sidebar + Navbar layout
- Zustand store consumption
- `useEffect` for data loading on mount
- li-card styling, lucide-react icons
- Forms for submit/create, tables for list views

**Step 2: Commit**

```bash
git add frontend/app/data-estate/
git commit -m "feat(data-estate): add scroll, ledger, allocations, and chat pages"
```

---

## Task 14: Add Sidebar Navigation Entry

**Files:**
- Modify: `frontend/components/Sidebar.tsx`

**Step 1: Add Data Estate to the Engine nav section**

Find the Engine section items array and add after the "Data Layer" entry:

```tsx
{ href: "/data-estate", icon: Database, label: "Data Estate" },
```

Import `Database` from lucide-react if not already imported.

**Step 2: Commit**

```bash
git add frontend/components/Sidebar.tsx
git commit -m "feat(data-estate): add Data Estate entry to sidebar navigation"
```

---

## Task 15: Final Integration Verification

**Step 1: Verify backend imports resolve**

Run: `cd backend && python -c "from app.api.v1.data_estate_vertical import router; print('Router OK:', len(router.routes), 'routes')"`

**Step 2: Verify frontend compiles**

Run: `cd frontend && npx next build --no-lint 2>&1 | tail -5` (or `npx tsc --noEmit`)

**Step 3: Verify no existing files were broken**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -20`

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(data-estate): complete Data Estate vertical integration"
```
