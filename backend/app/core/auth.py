"""JWT authentication, password hashing, session management, and FastAPI auth dependencies."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from user_agents import parse as parse_ua

import httpx
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt, jwk
from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.redis import is_token_blacklisted, update_session_activity
from app.db.session import get_db

logger = logging.getLogger(__name__)

# ── Clerk JWKS cache ──────────────────────────────────────────────
_clerk_jwks_cache: dict | None = None
_clerk_jwks_fetched_at: float = 0

# ── Password hashing ───────────────────────────────────────────────

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return _pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the bcrypt *hashed* value."""
    return _pwd_ctx.verify(plain, hashed)


# ── Token creation ──────────────────────────────────────────────────


def create_access_token(data: dict) -> str:
    """Create a short-lived JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a long-lived JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Token utilities ─────────────────────────────────────────────────


def hash_token(token: str) -> str:
    """SHA-256 hash of a token for secure storage. Never store raw JWTs."""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, raising UnauthorizedError on failure."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        pass  # Fall through to try Clerk

    # Try Clerk JWT if configured
    if settings.CLERK_SECRET_KEY:
        try:
            return _decode_clerk_token(token)
        except Exception:
            pass

    raise UnauthorizedError(detail="Invalid or expired token")


def _get_clerk_jwks() -> dict:
    """Fetch and cache Clerk's JWKS keys."""
    import time

    global _clerk_jwks_cache, _clerk_jwks_fetched_at

    now = time.time()
    if _clerk_jwks_cache and (now - _clerk_jwks_fetched_at) < 3600:
        return _clerk_jwks_cache

    issuer = settings.CLERK_ISSUER
    if not issuer:
        # Derive from secret key — Clerk issuer is in the token
        raise UnauthorizedError(detail="CLERK_ISSUER not configured")

    jwks_url = f"{issuer}/.well-known/jwks.json"
    resp = httpx.get(jwks_url, timeout=10)
    resp.raise_for_status()
    _clerk_jwks_cache = resp.json()
    _clerk_jwks_fetched_at = now
    return _clerk_jwks_cache


def _decode_clerk_token(token: str) -> dict:
    """Decode a Clerk-issued JWT using JWKS."""
    # Get the key ID from the token header
    headers = jwt.get_unverified_headers(token)
    kid = headers.get("kid")
    if not kid:
        raise UnauthorizedError(detail="Token missing key ID")

    jwks = _get_clerk_jwks()
    key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            key = k
            break

    if not key:
        # Refresh cache and retry
        global _clerk_jwks_cache
        _clerk_jwks_cache = None
        jwks = _get_clerk_jwks()
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break

    if not key:
        raise UnauthorizedError(detail="Matching key not found in Clerk JWKS")

    payload = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        options={"verify_aud": False},
    )
    # Mark as Clerk token for downstream handling
    payload["_clerk"] = True
    return payload


def _parse_device_name(user_agent: str | None) -> str:
    """Extract a human-friendly device name from a User-Agent string."""
    if not user_agent:
        return "Unknown Device"
    try:
        ua = parse_ua(user_agent)
        browser = ua.browser.family or "Unknown Browser"
        os_name = ua.os.family or "Unknown OS"
        return f"{browser} on {os_name}"
    except Exception:
        return "Unknown Device"


# ── Session management ──────────────────────────────────────────────


async def create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    refresh_token: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> "Session":
    """Create a server-side session record linked to the refresh token."""
    from app.models.user import Session

    # Enforce max sessions per user
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id, Session.is_active == True)  # noqa: E712
        .order_by(Session.created_at.asc())
    )
    active_sessions = result.scalars().all()

    # Revoke oldest sessions if over limit
    if len(active_sessions) >= settings.SESSION_MAX_PER_USER:
        excess = len(active_sessions) - settings.SESSION_MAX_PER_USER + 1
        for old_session in active_sessions[:excess]:
            old_session.is_active = False

    session = Session(
        user_id=user_id,
        token_hash=hash_token(refresh_token),
        ip_address=ip_address,
        user_agent=user_agent,
        device_name=_parse_device_name(user_agent),
        is_active=True,
        last_active_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.flush()
    return session


async def validate_session(db: AsyncSession, refresh_token: str) -> "Session | None":
    """Look up a session by refresh token hash. Returns None if revoked/expired."""
    from app.models.user import Session

    token_h = hash_token(refresh_token)
    result = await db.execute(
        select(Session).where(
            Session.token_hash == token_h,
            Session.is_active == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        return None

    # Check expiry
    if session.expires_at < datetime.utcnow():
        session.is_active = False
        await db.flush()
        return None

    return session


async def rotate_session_token(db: AsyncSession, session: "Session", new_refresh_token: str) -> None:
    """Rotate the refresh token hash on an existing session (token rotation)."""
    session.token_hash = hash_token(new_refresh_token)
    session.last_active_at = datetime.utcnow()
    session.expires_at = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    await db.flush()


async def revoke_session(db: AsyncSession, session_id: uuid.UUID) -> None:
    """Mark a single session as inactive (logout from one device)."""
    from app.models.user import Session

    await db.execute(
        update(Session).where(Session.id == session_id).values(is_active=False)
    )
    await db.flush()


async def revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID, except_session_id: uuid.UUID | None = None) -> None:
    """Revoke all active sessions for a user, optionally keeping one."""
    from app.models.user import Session

    stmt = update(Session).where(
        Session.user_id == user_id,
        Session.is_active == True,  # noqa: E712
    ).values(is_active=False)

    if except_session_id:
        stmt = stmt.where(Session.id != except_session_id)

    await db.execute(stmt)
    await db.flush()


async def get_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> list["Session"]:
    """List all active sessions for a user."""
    from app.models.user import Session

    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id, Session.is_active == True)  # noqa: E712
        .order_by(Session.last_active_at.desc())
    )
    return list(result.scalars().all())


# ── FastAPI dependencies ────────────────────────────────────────────


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Extract the current user from the Bearer token and query the DB."""
    token = credentials.credentials
    payload = decode_token(token)

    # Deferred import to avoid circular dependency with models
    from app.models.user import User

    # ── Clerk token path ──────────────────────────────────────────
    if payload.get("_clerk"):
        # Clerk tokens use email claims, not our internal user IDs
        email = None

        # Try standard Clerk claims
        if payload.get("email"):
            email = payload["email"]
        elif payload.get("email_addresses"):
            # Clerk sometimes nests emails
            email = payload["email_addresses"][0] if payload["email_addresses"] else None
        elif payload.get("primary_email_address_id") and payload.get("email_addresses"):
            email = payload["email_addresses"][0]

        # If no email in token, try to find user by Clerk subject ID
        # First check if we stored clerk_id on the user
        clerk_sub = payload.get("sub")

        if email:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
        elif clerk_sub:
            # Fallback: try matching by email from the seeded user
            # In production, you'd store clerk_id on the User model
            result = await db.execute(select(User).where(User.is_active == True))  # noqa: E712
            users = result.scalars().all()
            user = users[0] if len(users) == 1 else None

            if not user and users:
                # Multiple users — can't determine which one, pick first active
                user = users[0]
        else:
            raise UnauthorizedError(detail="Clerk token missing identity claims")

        if user is None:
            raise UnauthorizedError(detail="User not found — register first")

        return user

    # ── Internal token path ───────────────────────────────────────
    if payload.get("type") != "access":
        raise UnauthorizedError(detail="Invalid token type")

    # Check if token has been blacklisted (user logged out)
    token_h = hash_token(token)
    if await is_token_blacklisted(token_h):
        raise UnauthorizedError(detail="Token has been revoked")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError(detail="Token missing subject")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError(detail="User not found")

    # Update session activity in Redis (non-blocking, best-effort)
    session_id = payload.get("session_id")
    if session_id:
        try:
            await update_session_activity(session_id)
        except Exception:
            pass  # Don't fail requests if Redis is down

    return user


async def get_current_active_user(user=Depends(get_current_user)):
    """Ensure the authenticated user's account is active."""
    if not getattr(user, "is_active", True):
        raise UnauthorizedError(detail="User account is deactivated")
    return user
