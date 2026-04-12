"""Authentication endpoints: register, login, refresh, logout, sessions, password management."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Request

logger = logging.getLogger(__name__)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth import (
    create_access_token,
    create_refresh_token,
    create_session,
    decode_token,
    get_current_active_user,
    get_user_sessions,
    hash_password,
    hash_token,
    revoke_all_sessions,
    revoke_session,
    rotate_session_token,
    validate_session,
    verify_password,
)
from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.core.redis import blacklist_token, check_rate_limit
from app.db.session import get_db
from app.models.user import Organization, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SessionResponse,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Registration ────────────────────────────────────────────────────


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: UserRegister, request: Request, db: AsyncSession = Depends(get_db)):
    """Create a new user account with email verification token."""
    # Rate limit: 10 registrations per hour per IP
    client_ip = request.client.host if request.client else "unknown"
    if not await check_rate_limit(f"register:{client_ip}", 10, 3600):
        raise UnauthorizedError(detail="Too many registration attempts. Try again later.")

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

    # Generate email verification token
    verification_token = secrets.token_urlsafe(32)

    user = User(
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        organization_id=org_id,
        role="operator" if body.organization_name else "viewer",
        email_verified=False,
        email_verification_token=verification_token,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Send verification email (best-effort, don't block registration)
    try:
        from app.services.email import send_verification_email
        await send_verification_email(user.email, verification_token)
    except Exception:
        logger.warning("Failed to send verification email to %s", user.email, exc_info=True)

    return user


# ── Login ───────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate, create server-side session, and return JWT tokens."""
    # Rate limit: 5 login attempts per minute per IP
    client_ip = request.client.host if request.client else "unknown"
    if not await check_rate_limit(f"login:{client_ip}", 5, 60):
        raise UnauthorizedError(detail="Too many login attempts. Try again in a minute.")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise UnauthorizedError(detail="Invalid email or password")

    if not user.is_active:
        raise UnauthorizedError(detail="Account is deactivated")

    # Create token pair
    token_data = {"sub": str(user.id)}
    refresh_tok = create_refresh_token(token_data)

    # Create server-side session
    user_agent = request.headers.get("user-agent")
    session = await create_session(
        db=db,
        user_id=user.id,
        refresh_token=refresh_tok,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Include session_id in access token for activity tracking
    token_data["session_id"] = str(session.id)
    access_tok = create_access_token(token_data)

    # Update last login
    user.last_login_at = datetime.utcnow()
    await db.flush()

    return TokenResponse(
        access_token=access_tok,
        refresh_token=refresh_tok,
    )


# ── Token Refresh ───────────────────────────────────────────────────


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new token pair with session validation."""
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise UnauthorizedError(detail="Invalid token type")

    # Validate against server-side session
    session = await validate_session(db, body.refresh_token)
    if session is None:
        raise UnauthorizedError(detail="Session expired or revoked. Please log in again.")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedError(detail="User not found or inactive")

    # Generate new token pair (token rotation)
    token_data = {"sub": str(user.id), "session_id": str(session.id)}
    new_refresh = create_refresh_token({"sub": str(user.id)})
    new_access = create_access_token(token_data)

    # Rotate the session's stored token hash
    await rotate_session_token(db, session, new_refresh)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
    )


# ── Logout ──────────────────────────────────────────────────────────


@router.post("/logout", status_code=200)
async def logout(body: LogoutRequest, db: AsyncSession = Depends(get_db)):
    """Logout: revoke the session and blacklist the current access token."""
    # Find and revoke the session
    session = await validate_session(db, body.refresh_token)
    if session is not None:
        session.is_active = False
        await db.flush()

    # Blacklist the refresh token hash for its remaining TTL
    try:
        payload = decode_token(body.refresh_token)
        exp = payload.get("exp", 0)
        ttl = max(int(exp - datetime.utcnow().timestamp()), 0)
        if ttl > 0:
            await blacklist_token(hash_token(body.refresh_token), ttl)
    except Exception:
        pass  # Token may already be expired — safe to ignore

    return {"message": "Logged out successfully"}


@router.post("/logout-all", status_code=200)
async def logout_all(user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """Revoke all active sessions for the current user."""
    await revoke_all_sessions(db, user.id)
    return {"message": "All sessions revoked"}


# ── Session Management ──────────────────────────────────────────────


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(user=Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """List all active sessions for the current user."""
    sessions = await get_user_sessions(db, user.id)
    return [
        SessionResponse(
            id=s.id,
            ip_address=s.ip_address,
            user_agent=s.user_agent,
            device_name=s.device_name,
            last_active_at=s.last_active_at,
            created_at=s.created_at,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=200)
async def delete_session(
    session_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific session (remote logout from one device)."""
    from app.models.user import Session

    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user.id,
            Session.is_active == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise NotFoundError(detail="Session not found")

    session.is_active = False
    await db.flush()
    return {"message": "Session revoked"}


# ── Profile ─────────────────────────────────────────────────────────


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


# ── Password Management ─────────────────────────────────────────────


@router.post("/change-password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for the authenticated user. Revokes all other sessions."""
    if not verify_password(body.current_password, user.password_hash):
        raise UnauthorizedError(detail="Current password is incorrect")

    user.password_hash = hash_password(body.new_password)
    await db.flush()

    # Revoke all sessions (force re-login on all devices)
    await revoke_all_sessions(db, user.id)

    return {"message": "Password changed. Please log in again on all devices."}


@router.post("/forgot-password", status_code=200)
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Request a password reset email. Always returns 200 to prevent email enumeration."""
    # Rate limit
    client_ip = request.client.host if request.client else "unknown"
    if not await check_rate_limit(f"forgot:{body.email}", 3, 3600):
        return {"message": "If an account with that email exists, a reset link has been sent."}

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is not None:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        await db.flush()

        try:
            from app.services.email import send_password_reset_email
            await send_password_reset_email(user.email, reset_token)
        except Exception:
            logger.warning("Failed to send password reset email to %s", user.email, exc_info=True)

    # Always return the same response
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=200)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a token from the reset email."""
    result = await db.execute(
        select(User).where(User.password_reset_token == body.token)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError(detail="Invalid or expired reset token")

    if user.password_reset_expires and user.password_reset_expires < datetime.utcnow():
        user.password_reset_token = None
        user.password_reset_expires = None
        await db.flush()
        raise UnauthorizedError(detail="Reset token has expired. Please request a new one.")

    user.password_hash = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.flush()

    # Revoke all sessions
    await revoke_all_sessions(db, user.id)

    return {"message": "Password reset successfully. Please log in."}


# ── Email Verification ──────────────────────────────────────────────


@router.post("/verify-email", status_code=200)
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Verify a user's email address using the token from the verification email."""
    result = await db.execute(
        select(User).where(User.email_verification_token == body.token)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError(detail="Invalid verification token")

    user.email_verified = True
    user.email_verification_token = None
    await db.flush()

    return {"message": "Email verified successfully"}


@router.post("/resend-verification", status_code=200)
async def resend_verification(
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend the email verification email."""
    if user.email_verified:
        return {"message": "Email is already verified"}

    verification_token = secrets.token_urlsafe(32)
    user.email_verification_token = verification_token
    await db.flush()

    try:
        from app.services.email import send_verification_email
        await send_verification_email(user.email, verification_token)
    except Exception:
        logger.warning("Failed to resend verification email to %s", user.email, exc_info=True)

    return {"message": "Verification email sent"}
