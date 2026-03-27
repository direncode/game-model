"""Governance and lineage schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class LineageEventResponse(BaseModel):
    """Public representation of a lineage event."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    subject_type: str
    subject_id: uuid.UUID
    actor_type: str
    actor_id: uuid.UUID
    action: str
    inputs: Optional[dict[str, Any]] = None
    outputs: Optional[dict[str, Any]] = None
    parameters: Optional[dict[str, Any]] = None
    parent_event_id: Optional[uuid.UUID] = None
    created_at: datetime


class DataClassificationCreate(BaseModel):
    """Payload for classifying a dataset."""

    classification: str = Field(..., max_length=50)
    reasoning: str = Field(..., min_length=1)
