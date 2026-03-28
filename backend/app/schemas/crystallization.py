"""Crystallization job and training metric schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class CrystallizationConfig(BaseModel):
    """Configuration for a crystallization run."""

    module_count: Optional[int] = Field(default=None, ge=2, le=100)
    epochs: Optional[int] = Field(default=None, ge=1, le=1000)
    learning_rate: Optional[float] = Field(default=None, gt=0.0, le=1.0)
    module_capacity: Optional[int] = Field(default=None, ge=1)
    ph_filtration_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class CrystallizationJobResponse(BaseModel):
    """Public representation of a crystallization job."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    status: str
    config: Optional[dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    final_link_auc: Optional[float] = None
    final_knn_accuracy: Optional[float] = None
    module_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime


class TrainingMetricResponse(BaseModel):
    """Single training metric data point."""

    model_config = ConfigDict(from_attributes=True)

    epoch: int
    step: int
    loss: float
    link_auc: Optional[float] = None
    knn_accuracy: Optional[float] = None
    nan_detected: Optional[bool] = None
    gpu_utilization: Optional[float] = None
    recorded_at: datetime
