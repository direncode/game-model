"""Dataset-related Pydantic schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class DatasetCreate(BaseModel):
    """Payload for creating a new dataset."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DatasetResponse(BaseModel):
    """Public representation of a dataset."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    owner_id: uuid.UUID
    status: str
    entity_count: Optional[int] = None
    edge_count: Optional[int] = None
    density: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class EntityTypeResponse(BaseModel):
    """Public representation of an entity type."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    count: Optional[int] = None
    attributes: Optional[dict[str, Any]] = None


class RelationshipTypeResponse(BaseModel):
    """Public representation of a relationship type."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    source_type_id: uuid.UUID
    target_type_id: uuid.UUID
    count: Optional[int] = None


class DatasetProfile(BaseModel):
    """Profiling summary for a dataset."""

    entity_count: int = 0
    edge_count: int = 0
    density: float = 0.0
    entity_types: list[EntityTypeResponse] = []
    relationship_types: list[RelationshipTypeResponse] = []
    quality_score: float = 0.0


class SchemaMapping(BaseModel):
    """Column-mapping configuration for data ingestion."""

    entity_column: str
    entity_type_column: Optional[str] = None
    source_column: str
    target_column: str
    relationship_type_column: Optional[str] = None
    attribute_columns: Optional[list[str]] = None
