"""Pydantic schemas for QR Digital Identity system."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class QRMintRequest(BaseModel):
    subject_type: Literal["module", "bundle", "submission", "allocation", "dataset"]
    subject_id: uuid.UUID
    tier: Literal["public", "org", "admin"] = "public"
    org_id: uuid.UUID | None = None
    metadata: dict[str, Any] | None = None


class QRScanRequest(BaseModel):
    scanned_by: str | None = None
    ip_address: str | None = None


class QRIdentityOut(BaseModel):
    id: uuid.UUID
    code: str
    subject_type: str
    subject_id: uuid.UUID
    tier: str
    org_id: uuid.UUID | None
    minted_by: str
    minted_at: datetime
    revoked_at: datetime | None
    metadata: dict[str, Any] | None

    model_config = {"from_attributes": True}


class QRScanResult(BaseModel):
    qr_identity: QRIdentityOut
    access_granted: str
    entity_summary: dict[str, Any]
    lineage: dict[str, Any] | None = None


class QRScanLogOut(BaseModel):
    id: uuid.UUID
    qr_identity_id: uuid.UUID
    scanned_by: str | None
    scanned_at: datetime
    access_granted: str
    ip_address: str | None

    model_config = {"from_attributes": True}


class QRCodeImageOut(BaseModel):
    code: str
    image_base64: str
    url: str
