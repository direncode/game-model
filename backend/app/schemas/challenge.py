"""Challenge and comment schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChallengeCreate(BaseModel):
    """Payload for creating a new challenge."""

    challenge_type: str = Field(..., max_length=50)
    target_type: str = Field(..., max_length=50)
    target_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=500)
    reasoning: str = Field(..., min_length=1)
    evidence: Optional[dict[str, Any]] = None
    proposed_resolution: Optional[dict[str, Any]] = None


class ChallengeResponse(BaseModel):
    """Public representation of a challenge."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    job_id: uuid.UUID
    challenge_type: str
    target_type: str
    target_id: uuid.UUID
    challenger_id: uuid.UUID
    title: str
    reasoning: str
    evidence: Optional[dict[str, Any]] = None
    proposed_resolution: Optional[dict[str, Any]] = None
    status: str
    resolved_by: Optional[uuid.UUID] = None
    resolution_reasoning: Optional[str] = None
    resolved_at: Optional[datetime] = None
    impact_analysis: Optional[dict[str, Any]] = None
    created_at: datetime


class ChallengeCommentCreate(BaseModel):
    """Payload for adding a comment to a challenge."""

    content: str = Field(..., min_length=1)


class ChallengeCommentResponse(BaseModel):
    """Public representation of a challenge comment."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    challenge_id: uuid.UUID
    author_id: uuid.UUID
    content: str
    created_at: datetime


class ChallengeResolve(BaseModel):
    """Payload for resolving a challenge."""

    status: str = Field(..., pattern="^(accepted|rejected|deferred)$")
    resolution_reasoning: str = Field(..., min_length=1)


class ChallengeDetailResponse(ChallengeResponse):
    """Challenge with its comments."""

    comments: list[ChallengeCommentResponse] = []
