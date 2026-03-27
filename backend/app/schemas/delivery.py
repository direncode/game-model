"""Delivery schemas: reports and alert rules."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ReportGenerateRequest(BaseModel):
    """Payload for generating a report."""

    report_type: str = Field(..., max_length=100)
    format: str = Field(default="pdf", pattern="^(pdf|html|csv|json)$")


class ReportResponse(BaseModel):
    """Public representation of a generated report."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    job_id: uuid.UUID
    report_type: str
    title: str
    format: str
    generated_at: datetime


class AlertRuleCreate(BaseModel):
    """Payload for creating an alert rule."""

    rule_type: str = Field(..., max_length=100)
    conditions: dict[str, Any]
    delivery_method: str = Field(..., max_length=50)
    delivery_config: Optional[dict[str, Any]] = None


class AlertRuleUpdate(BaseModel):
    """Payload for updating an alert rule."""

    rule_type: Optional[str] = Field(default=None, max_length=100)
    conditions: Optional[dict[str, Any]] = None
    delivery_method: Optional[str] = Field(default=None, max_length=50)
    delivery_config: Optional[dict[str, Any]] = None
    active: Optional[bool] = None


class AlertRuleResponse(BaseModel):
    """Public representation of an alert rule."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    user_id: uuid.UUID
    rule_type: str
    conditions: Optional[dict[str, Any]] = None
    delivery_method: str
    active: bool
    created_at: datetime
