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
    email_verified: bool = False
    created_at: datetime


class UserUpdate(BaseModel):
    """Payload for updating the current user's profile."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=500)


# ── Session management schemas ───────────────────────────────────────


class RefreshRequest(BaseModel):
    """Payload for token refresh."""

    refresh_token: str


class LogoutRequest(BaseModel):
    """Payload for logout — includes refresh token to revoke the session."""

    refresh_token: str


class SessionResponse(BaseModel):
    """Active session info returned to the user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_name: Optional[str] = None
    last_active_at: Optional[datetime] = None
    created_at: datetime
    is_current: bool = False


# ── Password management schemas ──────────────────────────────────────


class ChangePasswordRequest(BaseModel):
    """Payload for changing password (authenticated)."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    """Payload for requesting a password reset email."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for resetting password with a token."""

    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    """Payload for verifying email with a token."""

    token: str
