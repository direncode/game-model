"""Pydantic schemas for the Data Estate vertical API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


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


class CrystallizeRequest(BaseModel):
    submission_ids: list[UUID] = Field(
        ..., min_length=1, description="Approved submissions to crystallize"
    )


class IncrementalRequest(BaseModel):
    submission_ids: list[UUID] = Field(
        ..., min_length=1, description="New approved submissions to add"
    )
    session_id: str = Field(..., description="Existing TCD-JEPA session ID")


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    estate_tag: str = Field(default="default")


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)
    module_hits: int = 0


class DashboardOut(BaseModel):
    total_submissions: int
    pending_submissions: int
    approved_submissions: int
    total_modules: int
    modules_by_type: dict[str, int]
    ledger_total: float
    ledger_categories: int
    allocation_requests_pending: int
