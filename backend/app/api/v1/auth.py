"""Authentication endpoints: register, login, refresh, profile."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_active_user,
    hash_password,
    verify_password,
)
from app.core.exceptions import ConflictError, UnauthorizedError
from app.db.session import get_db
from app.models.user import Organization, User
from app.schemas.auth import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    # Check for existing email
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise ConflictError(detail="Email already registered")

    # Create organization if requested
    org_id: uuid.UUID | None = None
    if body.organization_name:
        slug = body.organization_name.lower().replace(" ", "-")
        org = Organization(name=body.organization_name, slug=slug)
        db.add(org)
        await db.flush()
        org_id = org.id

    user = User(
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        organization_id=org_id,
        role="operator" if body.organization_name else "viewer",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate and return JWT tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise UnauthorizedError(detail="Invalid email or password")

    if not user.is_active:
        raise UnauthorizedError(detail="Account is deactivated")

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: dict, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new access/refresh pair."""
    token = body.get("refresh_token")
    if not token:
        raise UnauthorizedError(detail="Refresh token required")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise UnauthorizedError(detail="Invalid token type")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError(detail="User not found or inactive")

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_active_user)):
    """Return the current authenticated user."""
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    if body.name is not None:
        user.name = body.name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
