"""Authentication and user-related Pydantic schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    """Payload for user registration."""

    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    organization_name: Optional[str] = Field(default=None, max_length=255)


class UserLogin(BaseModel):
    """Payload for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token pair returned after authentication."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public representation of a user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    organization_id: Optional[uuid.UUID] = None
    created_at: datetime


class UserUpdate(BaseModel):
    """Payload for updating the current user's profile."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
