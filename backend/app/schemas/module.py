"""Module, entity, connection, and relationship schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ModuleResponse(BaseModel):
    """Public representation of a discovered module."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    dataset_id: uuid.UUID
    module_index: int
    name: str
    description: Optional[str] = None
    entity_count: Optional[int] = None
    dominant_type: Optional[str] = None
    purity_score: Optional[float] = None
    type_distribution: Optional[dict[str, Any]] = None
    anchor_entities: Optional[dict[str, Any]] = None
    internal_density: Optional[float] = None
    confidence: Optional[str] = None
    created_at: datetime


class ModuleEntityResponse(BaseModel):
    """Entity within a module."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_name: str
    entity_type: str
    attributes: Optional[dict[str, Any]] = None
    centrality_score: Optional[float] = None


class ModuleDetailResponse(ModuleResponse):
    """Module with full entity list."""

    entities: list[ModuleEntityResponse] = []


class ModuleUpdate(BaseModel):
    """Payload for updating a module's editable fields."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None


class HiddenConnectionResponse(BaseModel):
    """Public representation of a hidden connection."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_entity: str
    target_entity: str
    source_module_id: uuid.UUID
    target_module_id: uuid.UUID
    similarity_score: float
    has_direct_edge: bool
    description: Optional[str] = None
    validated: Optional[bool] = None
    created_at: datetime


class ConnectionValidate(BaseModel):
    """Payload for validating/invalidating a connection."""

    validated: bool


class ModuleRelationshipResponse(BaseModel):
    """Relationship between two modules."""

    model_config = ConfigDict(from_attributes=True)

    source_module_id: uuid.UUID
    target_module_id: uuid.UUID
    connection_strength: Optional[float] = None
    shared_entity_count: Optional[int] = None
    description: Optional[str] = None
