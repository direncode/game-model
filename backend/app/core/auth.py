"""JWT authentication, password hashing, and FastAPI auth dependencies."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.db.session import get_db

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
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a long-lived JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Token decoding ──────────────────────────────────────────────────


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, raising UnauthorizedError on failure."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as exc:
        raise UnauthorizedError(detail="Invalid or expired token") from exc


# ── FastAPI dependencies ────────────────────────────────────────────


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Extract the current user from the Bearer token and query the DB."""
    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise UnauthorizedError(detail="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError(detail="Token missing subject")

    # Deferred import to avoid circular dependency with models
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError(detail="User not found")

    return user


async def get_current_active_user(user=Depends(get_current_user)):
    """Ensure the authenticated user's account is active."""
    if not getattr(user, "is_active", True):
        raise UnauthorizedError(detail="User account is deactivated")
    return user
