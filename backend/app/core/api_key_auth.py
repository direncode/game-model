"""Scoped API key authentication for programmatic access."""

from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.db.session import get_db

logger = logging.getLogger(__name__)


# ── Scope model ──────────────────────────────────────────────────────


@dataclass
class APIKeyScope:
    """Defines what an API key can access."""

    read: bool = True
    write: bool = False
    reduce: bool = False
    query: bool = True
    admin: bool = False
    modules: list[str] = field(default_factory=list)  # Empty = all modules

    _VALID_SCOPES = {"read", "write", "reduce", "query", "admin"}

    @classmethod
    def from_list(cls, scopes: list[str]) -> "APIKeyScope":
        """Build an APIKeyScope from a list of scope strings.

        Scope strings can be plain flags like ``"read"`` or ``"write"``,
        or module grants like ``"module:fsd"``.
        """
        kwargs: dict = {}
        modules: list[str] = []
        for scope in scopes:
            if scope.startswith("module:"):
                modules.append(scope.split(":", 1)[1])
            elif scope in cls._VALID_SCOPES:
                kwargs[scope] = True
        return cls(**kwargs, modules=modules)

    def to_list(self) -> list[str]:
        """Serialize scopes to a flat list of strings."""
        out: list[str] = []
        for name in ("read", "write", "reduce", "query", "admin"):
            if getattr(self, name):
                out.append(name)
        for mod in self.modules:
            out.append(f"module:{mod}")
        return out

    def has_scope(self, scope: str) -> bool:
        """Return True if this key grants *scope*.

        Accepts plain flags (``"read"``) and module checks
        (``"module:fsd"``).  An empty modules list means *all* modules
        are permitted.
        """
        if scope.startswith("module:"):
            mod = scope.split(":", 1)[1]
            # Empty list = all modules allowed
            return len(self.modules) == 0 or mod in self.modules
        return getattr(self, scope, False)


# ── Key metadata ─────────────────────────────────────────────────────


@dataclass
class APIKeyRecord:
    """In-memory representation of a stored API key."""

    id: str
    name: str
    key_hash: str
    key_prefix: str
    user_id: str
    org_id: str
    scopes: APIKeyScope
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    is_active: bool = True


# ── Key manager ──────────────────────────────────────────────────────


class APIKeyManager:
    """Create, validate, and manage scoped API keys."""

    PREFIX = "lo_sk_"
    KEY_LENGTH = 32

    @staticmethod
    def generate_key() -> tuple[str, str]:
        """Generate a new API key.

        Returns:
            Tuple of (full_key, sha256_hash_for_storage).
        """
        raw = secrets.token_urlsafe(APIKeyManager.KEY_LENGTH)
        full_key = f"{APIKeyManager.PREFIX}{raw}"
        key_hash = hashlib.sha256(full_key.encode()).hexdigest()
        return full_key, key_hash

    @staticmethod
    def hash_key(key: str) -> str:
        """SHA-256 hash of a raw API key for secure comparison."""
        return hashlib.sha256(key.encode()).hexdigest()

    @staticmethod
    def validate_format(key: str) -> bool:
        """Return True if *key* looks like a valid Latent Ocean API key."""
        return (
            isinstance(key, str)
            and key.startswith(APIKeyManager.PREFIX)
            and len(key) > len(APIKeyManager.PREFIX) + 10
        )

    @staticmethod
    def extract_prefix(key: str) -> str:
        """Return the first 12 visible characters after the prefix (for display)."""
        stripped = key[len(APIKeyManager.PREFIX):]
        return f"{APIKeyManager.PREFIX}{stripped[:8]}..."


# ── In-memory store (swap for DB-backed in production) ───────────────


class APIKeyStore:
    """Simple in-memory API key store.

    In a real deployment this would be backed by the ``api_keys`` table
    in PostgreSQL.  The store is kept here to make the module self-contained
    and testable without a database.
    """

    def __init__(self) -> None:
        self._keys: dict[str, APIKeyRecord] = {}  # key_hash -> record
        self._by_id: dict[str, APIKeyRecord] = {}  # id -> record

    def store(self, record: APIKeyRecord) -> None:
        self._keys[record.key_hash] = record
        self._by_id[record.id] = record

    def lookup_by_hash(self, key_hash: str) -> Optional[APIKeyRecord]:
        return self._keys.get(key_hash)

    def lookup_by_id(self, key_id: str) -> Optional[APIKeyRecord]:
        return self._by_id.get(key_id)

    def list_for_user(self, user_id: str) -> list[APIKeyRecord]:
        return [r for r in self._keys.values() if r.user_id == user_id and r.is_active]

    def revoke(self, key_id: str) -> bool:
        record = self._by_id.get(key_id)
        if record is None:
            return False
        record.is_active = False
        return True

    def rotate(self, key_id: str) -> tuple[str, APIKeyRecord] | None:
        """Revoke the old key and issue a replacement with identical scopes."""
        old = self._by_id.get(key_id)
        if old is None or not old.is_active:
            return None
        old.is_active = False

        new_key, new_hash = APIKeyManager.generate_key()
        new_record = APIKeyRecord(
            id=str(uuid.uuid4()),
            name=old.name,
            key_hash=new_hash,
            key_prefix=APIKeyManager.extract_prefix(new_key),
            user_id=old.user_id,
            org_id=old.org_id,
            scopes=old.scopes,
            created_at=datetime.now(timezone.utc),
            expires_at=old.expires_at,
            is_active=True,
        )
        self.store(new_record)
        return new_key, new_record


# Global store instance — replace with DI in production
_store = APIKeyStore()


def get_api_key_store() -> APIKeyStore:
    """Return the global API key store."""
    return _store


# ── FastAPI dependency ───────────────────────────────────────────────


async def get_api_key_user(request: Request) -> dict:
    """Extract and validate an API key from request headers.

    Checks the ``X-API-Key`` header first, then falls back to
    ``Authorization: Bearer lo_sk_...``.

    Returns a dict suitable for use as a user context::

        {
            "user_id": "...",
            "org_id": "...",
            "scopes": APIKeyScope(...),
            "key_id": "...",
            "auth_type": "api_key",
        }
    """
    api_key: str | None = request.headers.get("X-API-Key")

    if api_key is None:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer ") and auth_header[7:].startswith(APIKeyManager.PREFIX):
            api_key = auth_header[7:]

    if api_key is None:
        raise UnauthorizedError(detail="API key required — pass X-API-Key header or Bearer token")

    if not APIKeyManager.validate_format(api_key):
        raise UnauthorizedError(detail="Malformed API key")

    key_hash = APIKeyManager.hash_key(api_key)
    store = get_api_key_store()
    record = store.lookup_by_hash(key_hash)

    if record is None:
        logger.warning("API key lookup failed (hash prefix: %s...)", key_hash[:12])
        raise UnauthorizedError(detail="Invalid API key")

    if not record.is_active:
        raise UnauthorizedError(detail="API key has been revoked")

    if record.expires_at and record.expires_at < datetime.now(timezone.utc):
        raise UnauthorizedError(detail="API key has expired")

    # Touch last-used timestamp
    record.last_used_at = datetime.now(timezone.utc)

    logger.info(
        "API key auth: key_id=%s user=%s scopes=%s",
        record.id,
        record.user_id,
        record.scopes.to_list(),
    )

    return {
        "user_id": record.user_id,
        "org_id": record.org_id,
        "scopes": record.scopes,
        "key_id": record.id,
        "key_name": record.name,
        "auth_type": "api_key",
    }


def require_api_scope(scope: str):
    """FastAPI dependency factory — ensures the API key has a specific scope."""

    async def _check(ctx: dict = Depends(get_api_key_user)) -> dict:
        scopes: APIKeyScope = ctx["scopes"]
        if not scopes.has_scope(scope):
            raise ForbiddenError(
                detail=f"API key missing required scope '{scope}'"
            )
        return ctx

    return _check
