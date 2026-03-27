"""Admin and audit log schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserResponse


class UserUpdateRole(BaseModel):
    """Payload for updating a user's role."""

    role: str = Field(..., pattern="^(viewer|analyst|operator|admin|auditor)$")


class UserListResponse(BaseModel):
    """Paginated list of users."""

    users: list[UserResponse]
    total: int


class AuditLogResponse(BaseModel):
    """Public representation of an audit log entry."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: uuid.UUID
    timestamp: datetime
    actor_id: Optional[uuid.UUID] = None
    actor_type: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[uuid.UUID] = None
    result: Optional[str] = None


class AuditLogListResponse(BaseModel):
    """Paginated list of audit log entries."""

    logs: list[AuditLogResponse]
    total: int
