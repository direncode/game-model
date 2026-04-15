"""API key management endpoints."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.api_key_auth import (
    APIKeyManager,
    APIKeyRecord,
    APIKeyScope,
    get_api_key_store,
)
from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


# ── Request / response schemas ───────────────────────────────────────


class CreateKeyRequest(BaseModel):
    """Request body for creating an API key."""
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable key name")
    scopes: list[str] = Field(default_factory=lambda: ["read", "query"], description="Scopes to grant")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Days until expiry (None = no expiry)")


class CreateKeyResponse(BaseModel):
    """Response for key creation — the full key is shown only here."""
    id: str
    name: str
    key: str  # Full API key — shown only once!
    key_prefix: str
    scopes: list[str]
    created_at: str
    expires_at: Optional[str]


class KeySummary(BaseModel):
    """Summary view of an API key (no secret material)."""
    id: str
    name: str
    key_prefix: str
    scopes: list[str]
    created_at: str
    expires_at: Optional[str]
    last_used_at: Optional[str]
    is_active: bool


class UpdateKeyRequest(BaseModel):
    """Request body for updating an API key."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    scopes: Optional[list[str]] = None
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)


class RotateKeyResponse(BaseModel):
    """Response for key rotation."""
    id: str
    name: str
    key: str  # New full API key — shown only once!
    key_prefix: str
    scopes: list[str]
    old_key_id: str


# ── Helpers ──────────────────────────────────────────────────────────


def _record_to_summary(record: APIKeyRecord) -> KeySummary:
    return KeySummary(
        id=record.id,
        name=record.name,
        key_prefix=record.key_prefix,
        scopes=record.scopes.to_list(),
        created_at=record.created_at.isoformat(),
        expires_at=record.expires_at.isoformat() if record.expires_at else None,
        last_used_at=record.last_used_at.isoformat() if record.last_used_at else None,
        is_active=record.is_active,
    )


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("/", response_model=CreateKeyResponse)
async def create_api_key(
    body: CreateKeyRequest,
    user=Depends(get_current_active_user),
):
    """Create a new API key.

    The full key is returned **only in this response**. Store it
    securely — it cannot be retrieved again.
    """
    # Validate scopes
    scope_obj = APIKeyScope.from_list(body.scopes)

    # Only admins can create keys with admin or write scopes
    user_role = getattr(user, "role", "viewer")
    if scope_obj.admin and user_role != "admin":
        raise ValidationError(detail="Only admins can create keys with 'admin' scope")
    if scope_obj.write and user_role not in ("admin", "operator"):
        raise ValidationError(detail="Only operators and admins can create keys with 'write' scope")

    # Generate the key
    full_key, key_hash = APIKeyManager.generate_key()
    key_prefix = APIKeyManager.extract_prefix(full_key)

    now = datetime.now(timezone.utc)
    expires_at = None
    if body.expires_in_days:
        expires_at = now + timedelta(days=body.expires_in_days)

    record = APIKeyRecord(
        id=str(uuid.uuid4()),
        name=body.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        user_id=str(user.id),
        org_id=str(getattr(user, "organization_id", "") or ""),
        scopes=scope_obj,
        created_at=now,
        expires_at=expires_at,
        is_active=True,
    )

    store = get_api_key_store()
    store.store(record)

    logger.info("API key created: id=%s name=%s user=%s scopes=%s", record.id, record.name, record.user_id, body.scopes)

    return CreateKeyResponse(
        id=record.id,
        name=record.name,
        key=full_key,
        key_prefix=key_prefix,
        scopes=scope_obj.to_list(),
        created_at=now.isoformat(),
        expires_at=expires_at.isoformat() if expires_at else None,
    )


@router.get("/", response_model=list[KeySummary])
async def list_api_keys(
    user=Depends(get_current_active_user),
):
    """List API keys for the current user (shows prefix only)."""
    store = get_api_key_store()
    records = store.list_for_user(str(user.id))
    return [_record_to_summary(r) for r in records]


@router.get("/{key_id}", response_model=KeySummary)
async def get_api_key(
    key_id: str,
    user=Depends(get_current_active_user),
):
    """Get details of a specific API key."""
    store = get_api_key_store()
    record = store.lookup_by_id(key_id)

    if record is None:
        raise NotFoundError(detail="API key not found")

    # Users can only see their own keys (admins can see all)
    if record.user_id != str(user.id) and getattr(user, "role", "") != "admin":
        raise NotFoundError(detail="API key not found")

    return _record_to_summary(record)


@router.patch("/{key_id}", response_model=KeySummary)
async def update_api_key(
    key_id: str,
    body: UpdateKeyRequest,
    user=Depends(get_current_active_user),
):
    """Update an API key's name, scopes, or expiry."""
    store = get_api_key_store()
    record = store.lookup_by_id(key_id)

    if record is None:
        raise NotFoundError(detail="API key not found")

    if record.user_id != str(user.id) and getattr(user, "role", "") != "admin":
        raise NotFoundError(detail="API key not found")

    if not record.is_active:
        raise ValidationError(detail="Cannot update a revoked API key")

    if body.name is not None:
        record.name = body.name

    if body.scopes is not None:
        new_scope = APIKeyScope.from_list(body.scopes)
        user_role = getattr(user, "role", "viewer")
        if new_scope.admin and user_role != "admin":
            raise ValidationError(detail="Only admins can grant 'admin' scope")
        record.scopes = new_scope

    if body.expires_in_days is not None:
        record.expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)

    logger.info("API key updated: id=%s", key_id)
    return _record_to_summary(record)


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    user=Depends(get_current_active_user),
):
    """Revoke an API key (permanently deactivate)."""
    store = get_api_key_store()
    record = store.lookup_by_id(key_id)

    if record is None:
        raise NotFoundError(detail="API key not found")

    if record.user_id != str(user.id) and getattr(user, "role", "") != "admin":
        raise NotFoundError(detail="API key not found")

    if not record.is_active:
        return {"status": "already_revoked", "key_id": key_id}

    store.revoke(key_id)
    logger.info("API key revoked: id=%s user=%s", key_id, record.user_id)
    return {"status": "revoked", "key_id": key_id}


@router.post("/{key_id}/rotate", response_model=RotateKeyResponse)
async def rotate_api_key(
    key_id: str,
    user=Depends(get_current_active_user),
):
    """Rotate an API key — issues a new key and revokes the old one.

    The new full key is returned **only in this response**.
    """
    store = get_api_key_store()
    record = store.lookup_by_id(key_id)

    if record is None:
        raise NotFoundError(detail="API key not found")

    if record.user_id != str(user.id) and getattr(user, "role", "") != "admin":
        raise NotFoundError(detail="API key not found")

    result = store.rotate(key_id)
    if result is None:
        raise ValidationError(detail="Cannot rotate an inactive API key")

    new_key, new_record = result

    logger.info("API key rotated: old_id=%s new_id=%s user=%s", key_id, new_record.id, record.user_id)

    return RotateKeyResponse(
        id=new_record.id,
        name=new_record.name,
        key=new_key,
        key_prefix=new_record.key_prefix,
        scopes=new_record.scopes.to_list(),
        old_key_id=key_id,
    )
