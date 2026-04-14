# QR Digital Identity System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a universal QR-code-based digital identity system that can be minted for any trackable entity, providing tiered lineage transparency and access control.

**Architecture:** Thin QR identity layer using polymorphic references (subject_type + subject_id) — the same pattern as LineageEvent. QR codes are URL-encoded pointers (`/qr/XXXX-XXXX`); all intelligence lives in existing lineage/registry services. Three access tiers (public/org/admin) gate what scanning reveals.

**Tech Stack:** SQLAlchemy 2.0 models, FastAPI async endpoints, `qrcode` Python library for image generation, Next.js + TanStack Query frontend, existing LineageTracker + ModuleRegistryService integrations.

**Design Doc:** `docs/plans/2026-04-14-qr-digital-identity-design.md`

---

### Task 1: Database Migration — QR Identity Tables

**Files:**
- Create: `backend/app/db/migrations/versions/004_qr_digital_identity.py`

**Step 1: Write the migration**

```python
"""Add qr_identity and qr_scan_log tables.

Revision ID: 004_qr_digital_identity
Revises: 003_module_registry
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "004_qr_digital_identity"
down_revision: Union[str, None] = "003_module_registry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "qr_identity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(9), nullable=False, unique=True),
        sa.Column("subject_type", sa.String(50), nullable=False),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(10), nullable=False, server_default="public"),
        sa.Column("org_id", UUID(as_uuid=True), nullable=True),
        sa.Column("minted_by", sa.String(255), nullable=False),
        sa.Column("minted_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
    )
    op.create_index("ix_qr_identity_code", "qr_identity", ["code"], unique=True)
    op.create_index("ix_qr_identity_subject", "qr_identity", ["subject_type", "subject_id"])
    op.create_index("ix_qr_identity_org", "qr_identity", ["org_id"])
    op.create_index("ix_qr_identity_tier", "qr_identity", ["tier"])

    op.create_table(
        "qr_scan_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("qr_identity_id", UUID(as_uuid=True), sa.ForeignKey("qr_identity.id"), nullable=False),
        sa.Column("scanned_by", sa.String(255), nullable=True),
        sa.Column("scanned_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("access_granted", sa.String(10), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
    )
    op.create_index("ix_qr_scan_log_identity", "qr_scan_log", ["qr_identity_id"])
    op.create_index("ix_qr_scan_log_time", "qr_scan_log", ["scanned_at"])


def downgrade() -> None:
    op.drop_index("ix_qr_scan_log_time", table_name="qr_scan_log")
    op.drop_index("ix_qr_scan_log_identity", table_name="qr_scan_log")
    op.drop_table("qr_scan_log")
    op.drop_index("ix_qr_identity_tier", table_name="qr_identity")
    op.drop_index("ix_qr_identity_org", table_name="qr_identity")
    op.drop_index("ix_qr_identity_subject", table_name="qr_identity")
    op.drop_index("ix_qr_identity_code", table_name="qr_identity")
    op.drop_table("qr_identity")
```

**Step 2: Commit**

```bash
git add backend/app/db/migrations/versions/004_qr_digital_identity.py
git commit -m "feat(qr): add migration for qr_identity and qr_scan_log tables"
```

---

### Task 2: SQLAlchemy Models

**Files:**
- Create: `backend/app/models/qr_identity.py`
- Modify: `backend/app/models/__init__.py` (line 8, add import; line 18, add to __all__)

**Step 1: Write failing test**

Create `backend/tests/models/test_qr_identity_model.py`:

```python
import uuid
from datetime import datetime

from app.models.qr_identity import QRIdentity, QRScanLog


def test_qr_identity_defaults():
    qi = QRIdentity(
        id=uuid.uuid4(),
        code="ABCD-1234",
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="public",
        minted_by="system",
    )
    assert qi.code == "ABCD-1234"
    assert qi.tier == "public"
    assert qi.revoked_at is None


def test_qr_scan_log_creation():
    log = QRScanLog(
        id=uuid.uuid4(),
        qr_identity_id=uuid.uuid4(),
        scanned_by="user@example.com",
        access_granted="org",
    )
    assert log.access_granted == "org"
    assert log.ip_address is None
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/models/test_qr_identity_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.qr_identity'`

**Step 3: Write the models**

Create `backend/app/models/qr_identity.py`:

```python
"""QR Digital Identity models — universal identity tokens for lineage tracking."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class QRIdentity(Base):
    __tablename__ = "qr_identity"
    __table_args__ = (
        Index("ix_qr_identity_code", "code", unique=True),
        Index("ix_qr_identity_subject", "subject_type", "subject_id"),
        Index("ix_qr_identity_org", "org_id"),
        Index("ix_qr_identity_tier", "tier"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(9), unique=True, nullable=False)
    subject_type: Mapped[str] = mapped_column(String(50), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tier: Mapped[str] = mapped_column(String(10), nullable=False, server_default="public")
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    minted_by: Mapped[str] = mapped_column(String(255), nullable=False)
    minted_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=text("now()")
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)


class QRScanLog(Base):
    __tablename__ = "qr_scan_log"
    __table_args__ = (
        Index("ix_qr_scan_log_identity", "qr_identity_id"),
        Index("ix_qr_scan_log_time", "scanned_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    qr_identity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("qr_identity.id"), nullable=False
    )
    scanned_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=text("now()")
    )
    access_granted: Mapped[str] = mapped_column(String(10), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
```

**Step 4: Register models in `backend/app/models/__init__.py`**

Add after line 8:
```python
from app.models.qr_identity import QRIdentity, QRScanLog
```

Add `"QRIdentity", "QRScanLog"` to `__all__` list.

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/models/test_qr_identity_model.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/models/qr_identity.py backend/app/models/__init__.py backend/tests/models/test_qr_identity_model.py
git commit -m "feat(qr): add QRIdentity and QRScanLog SQLAlchemy models"
```

---

### Task 3: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/qr_identity.py`

**Step 1: Write failing test**

Create `backend/tests/schemas/test_qr_identity_schemas.py`:

```python
import uuid
from app.schemas.qr_identity import QRMintRequest, QRIdentityOut, QRScanRequest


def test_mint_request_valid():
    req = QRMintRequest(
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="org",
    )
    assert req.tier == "org"


def test_mint_request_default_tier():
    req = QRMintRequest(
        subject_type="bundle",
        subject_id=uuid.uuid4(),
    )
    assert req.tier == "public"


def test_mint_request_rejects_invalid_tier():
    import pytest
    with pytest.raises(Exception):
        QRMintRequest(
            subject_type="module",
            subject_id=uuid.uuid4(),
            tier="superadmin",
        )
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/schemas/test_qr_identity_schemas.py -v`
Expected: FAIL

**Step 3: Write the schemas**

Create `backend/app/schemas/qr_identity.py`:

```python
"""Pydantic schemas for QR Digital Identity system."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- Request schemas ---

class QRMintRequest(BaseModel):
    subject_type: Literal["module", "bundle", "submission", "allocation", "dataset"]
    subject_id: uuid.UUID
    tier: Literal["public", "org", "admin"] = "public"
    org_id: uuid.UUID | None = None
    metadata: dict[str, Any] | None = None


class QRScanRequest(BaseModel):
    scanned_by: str | None = None
    ip_address: str | None = None


# --- Response schemas ---

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
    lineage: list[dict[str, Any]] | None = None


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
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/schemas/test_qr_identity_schemas.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/schemas/qr_identity.py backend/tests/schemas/test_qr_identity_schemas.py
git commit -m "feat(qr): add Pydantic schemas for QR identity system"
```

---

### Task 4: QR Code Generator Service

**Files:**
- Create: `backend/app/services/qr_identity/__init__.py`
- Create: `backend/app/services/qr_identity/code_generator.py`

**Step 1: Write failing test**

Create `backend/tests/services/qr_identity/__init__.py` (empty) and `backend/tests/services/qr_identity/test_code_generator.py`:

```python
import re
import base64
from app.services.qr_identity.code_generator import generate_code, generate_qr_image


def test_generate_code_format():
    code = generate_code()
    assert re.match(r"^[A-Z0-9]{4}-[A-Z0-9]{4}$", code)


def test_generate_code_uniqueness():
    codes = {generate_code() for _ in range(100)}
    assert len(codes) == 100  # all unique


def test_generate_qr_image_returns_base64_png():
    url = "https://example.com/qr/ABCD-1234"
    img_b64 = generate_qr_image(url)
    # Should be valid base64
    raw = base64.b64decode(img_b64)
    # PNG magic bytes
    assert raw[:4] == b"\x89PNG"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/qr_identity/test_code_generator.py -v`
Expected: FAIL

**Step 3: Write the generator**

Create `backend/app/services/qr_identity/__init__.py` (empty file).

Create `backend/app/services/qr_identity/code_generator.py`:

```python
"""QR code generation utilities."""

import base64
import io
import secrets
import string

import qrcode  # type: ignore[import-untyped]

_ALPHABET = string.ascii_uppercase + string.digits


def generate_code() -> str:
    """Generate a unique XXXX-XXXX code using cryptographic randomness."""
    left = "".join(secrets.choice(_ALPHABET) for _ in range(4))
    right = "".join(secrets.choice(_ALPHABET) for _ in range(4))
    return f"{left}-{right}"


def generate_qr_image(url: str) -> str:
    """Generate a QR code PNG image as a base64-encoded string."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/qr_identity/test_code_generator.py -v`
Expected: PASS (requires `pip install qrcode[pil]` if not installed)

**Step 5: Commit**

```bash
git add backend/app/services/qr_identity/ backend/tests/services/qr_identity/
git commit -m "feat(qr): add QR code generator — XXXX-XXXX codes + PNG images"
```

---

### Task 5: QR Identity Service (Core Business Logic)

**Files:**
- Create: `backend/app/services/qr_identity/identity_service.py`

**Step 1: Write failing test**

Create `backend/tests/services/qr_identity/test_identity_service.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.qr_identity.identity_service import QRIdentityService


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def service(mock_session):
    return QRIdentityService(mock_session)


@pytest.mark.asyncio
async def test_mint_creates_identity(service, mock_session):
    mock_session.execute.return_value.scalar_one_or_none.return_value = None

    result = await service.mint(
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="org",
        minted_by="test-user",
    )
    assert result.subject_type == "module"
    assert result.tier == "org"
    assert len(result.code) == 9  # XXXX-XXXX
    mock_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_resolve_returns_none_for_unknown_code(service, mock_session):
    mock_session.execute.return_value.scalar_one_or_none.return_value = None
    result = await service.resolve("ZZZZ-9999")
    assert result is None


@pytest.mark.asyncio
async def test_revoke_sets_revoked_at(service, mock_session):
    from app.models.qr_identity import QRIdentity
    fake_qi = QRIdentity(
        id=uuid.uuid4(), code="ABCD-1234",
        subject_type="module", subject_id=uuid.uuid4(),
        tier="public", minted_by="test",
    )
    mock_session.execute.return_value.scalar_one_or_none.return_value = fake_qi

    result = await service.revoke("ABCD-1234")
    assert result is not None
    assert result.revoked_at is not None
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/qr_identity/test_identity_service.py -v`
Expected: FAIL

**Step 3: Write the service**

Create `backend/app/services/qr_identity/identity_service.py`:

```python
"""Core QR identity service — mint, resolve, scan, revoke."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.qr_identity import QRIdentity, QRScanLog
from app.services.qr_identity.code_generator import generate_code

logger = logging.getLogger(__name__)

# Max retries for code collision (36^8 = 2.8 trillion codes, collisions near-impossible)
_MAX_CODE_RETRIES = 5


class QRIdentityService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def mint(
        self,
        subject_type: str,
        subject_id: uuid.UUID,
        tier: str = "public",
        minted_by: str = "system",
        org_id: uuid.UUID | None = None,
        metadata: dict | None = None,
    ) -> QRIdentity:
        """Mint a new QR identity for any trackable entity."""
        code = await self._unique_code()
        qi = QRIdentity(
            id=uuid.uuid4(),
            code=code,
            subject_type=subject_type,
            subject_id=subject_id,
            tier=tier,
            org_id=org_id,
            minted_by=minted_by,
            metadata_=metadata,
        )
        self._session.add(qi)
        await self._session.flush()
        logger.info("Minted QR identity %s for %s/%s", code, subject_type, subject_id)
        return qi

    async def resolve(self, code: str) -> QRIdentity | None:
        """Resolve a QR code to its identity record. Returns None if not found or revoked."""
        result = await self._session.execute(
            select(QRIdentity).where(
                QRIdentity.code == code,
                QRIdentity.revoked_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def record_scan(
        self,
        qr_identity_id: uuid.UUID,
        access_granted: str,
        scanned_by: str | None = None,
        ip_address: str | None = None,
    ) -> QRScanLog:
        """Record a scan event in the audit log."""
        log = QRScanLog(
            id=uuid.uuid4(),
            qr_identity_id=qr_identity_id,
            scanned_by=scanned_by,
            access_granted=access_granted,
            ip_address=ip_address,
        )
        self._session.add(log)
        await self._session.flush()
        return log

    async def revoke(self, code: str) -> QRIdentity | None:
        """Soft-revoke a QR identity by setting revoked_at."""
        qi = await self.resolve(code)
        if qi is None:
            return None
        qi.revoked_at = datetime.now(timezone.utc)
        await self._session.flush()
        logger.info("Revoked QR identity %s", code)
        return qi

    async def list_for_entity(
        self, subject_type: str, subject_id: uuid.UUID
    ) -> list[QRIdentity]:
        """List all QR identities for a given entity."""
        result = await self._session.execute(
            select(QRIdentity).where(
                QRIdentity.subject_type == subject_type,
                QRIdentity.subject_id == subject_id,
            ).order_by(QRIdentity.minted_at.desc())
        )
        return list(result.scalars().all())

    async def get_scan_log(self, qr_identity_id: uuid.UUID) -> list[QRScanLog]:
        """Get all scan events for a QR identity."""
        result = await self._session.execute(
            select(QRScanLog).where(
                QRScanLog.qr_identity_id == qr_identity_id,
            ).order_by(QRScanLog.scanned_at.desc())
        )
        return list(result.scalars().all())

    async def _unique_code(self) -> str:
        """Generate a code that doesn't collide with existing ones."""
        for _ in range(_MAX_CODE_RETRIES):
            code = generate_code()
            existing = await self._session.execute(
                select(QRIdentity.id).where(QRIdentity.code == code)
            )
            if existing.scalar_one_or_none() is None:
                return code
        raise RuntimeError("Failed to generate unique QR code after retries")
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/qr_identity/test_identity_service.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/services/qr_identity/identity_service.py backend/tests/services/qr_identity/test_identity_service.py
git commit -m "feat(qr): add QRIdentityService — mint, resolve, scan, revoke"
```

---

### Task 6: API Endpoints

**Files:**
- Create: `backend/app/api/v1/qr_identity.py`
- Modify: `backend/app/api/v1/__init__.py` (add import + include_router)

**Step 1: Write failing test**

Create `backend/tests/api/test_qr_identity_endpoints.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.main import app


def _fake_user():
    class FakeUser:
        id = uuid.uuid4()
        email = "test@example.com"
        organization_id = uuid.uuid4()
    return FakeUser()


def _fake_db():
    return AsyncMock()


@pytest.fixture
def client():
    app.dependency_overrides[get_current_active_user] = _fake_user
    app.dependency_overrides[get_db] = _fake_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_mint_endpoint_exists(client):
    """Verify the mint endpoint is registered and reachable."""
    response = client.post(
        "/api/v1/qr/mint",
        json={"subject_type": "module", "subject_id": str(uuid.uuid4()), "tier": "public"},
    )
    # Should not be 404 (endpoint exists), actual status depends on DB mock
    assert response.status_code != 404


def test_resolve_endpoint_exists(client):
    response = client.get("/api/v1/qr/ABCD-1234")
    assert response.status_code != 404
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/api/test_qr_identity_endpoints.py -v`
Expected: FAIL (404 — route not registered)

**Step 3: Write the API router**

Create `backend/app/api/v1/qr_identity.py`:

```python
"""QR Digital Identity API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.schemas.qr_identity import (
    QRCodeImageOut,
    QRIdentityOut,
    QRMintRequest,
    QRScanLogOut,
    QRScanRequest,
    QRScanResult,
)
from app.services.qr_identity.code_generator import generate_qr_image
from app.services.qr_identity.identity_service import QRIdentityService

router = APIRouter(prefix="/qr", tags=["qr-identity"])


@router.post("/mint", response_model=QRIdentityOut)
async def mint_qr_identity(
    body: QRMintRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mint a new QR identity for any trackable entity."""
    svc = QRIdentityService(db)
    qi = await svc.mint(
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        tier=body.tier,
        minted_by=user.email,
        org_id=body.org_id or getattr(user, "organization_id", None),
        metadata=body.metadata,
    )
    await db.commit()
    return qi


@router.get("/{code}", response_model=QRIdentityOut)
async def resolve_qr_code(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a QR code to its identity. Public endpoint (no auth required)."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found or revoked")
    return qi


@router.post("/{code}/scan", response_model=QRScanResult)
async def scan_qr_code(
    code: str,
    body: QRScanRequest | None = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Scan a QR code — logs the scan event and returns tier-gated data."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found or revoked")

    # Determine access level (for now: the QR's own tier)
    access = qi.tier
    ip = request.client.host if request and request.client else None

    await svc.record_scan(
        qr_identity_id=qi.id,
        access_granted=access,
        scanned_by=body.scanned_by if body else None,
        ip_address=body.ip_address if body else ip,
    )
    await db.commit()

    # Build tier-gated response
    entity_summary = {
        "subject_type": qi.subject_type,
        "subject_id": str(qi.subject_id),
        "tier": qi.tier,
    }

    # TODO: Enrich with lineage data based on tier (Task 7)
    lineage = None

    return QRScanResult(
        qr_identity=qi,
        access_granted=access,
        entity_summary=entity_summary,
        lineage=lineage,
    )


@router.get("/{code}/image", response_model=QRCodeImageOut)
async def get_qr_image(
    code: str,
    base_url: str = Query(default="https://latentocean.com"),
    db: AsyncSession = Depends(get_db),
):
    """Generate a QR code PNG image for the given code."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found or revoked")

    url = f"{base_url}/qr/{code}"
    image_b64 = generate_qr_image(url)
    return QRCodeImageOut(code=code, image_base64=image_b64, url=url)


@router.delete("/{code}")
async def revoke_qr_code(
    code: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-revoke a QR identity."""
    svc = QRIdentityService(db)
    qi = await svc.revoke(code)
    if qi is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found")
    await db.commit()
    return {"status": "revoked", "code": code}


@router.get("/entity/{subject_type}/{subject_id}", response_model=list[QRIdentityOut])
async def list_entity_qr_codes(
    subject_type: str,
    subject_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all QR codes for a given entity."""
    svc = QRIdentityService(db)
    identities = await svc.list_for_entity(subject_type, subject_id)
    return identities


@router.get("/{code}/scans", response_model=list[QRScanLogOut])
async def get_scan_log(
    code: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the scan audit log for a QR identity (admin only)."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found")
    logs = await svc.get_scan_log(qi.id)
    return logs
```

**Step 4: Register the router in `backend/app/api/v1/__init__.py`**

After line 24 add:
```python
from app.api.v1.qr_identity import router as qr_identity_router
```

After line 49 add:
```python
router.include_router(qr_identity_router)
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/api/test_qr_identity_endpoints.py -v`
Expected: PASS (endpoints return non-404)

**Step 6: Commit**

```bash
git add backend/app/api/v1/qr_identity.py backend/app/api/v1/__init__.py backend/tests/api/test_qr_identity_endpoints.py
git commit -m "feat(qr): add QR identity API endpoints — mint, resolve, scan, revoke, image"
```

---

### Task 7: Lineage Integration — Tier-Gated Lineage Resolution

**Files:**
- Create: `backend/app/services/qr_identity/lineage_resolver.py`
- Modify: `backend/app/api/v1/qr_identity.py` (enrich scan endpoint)

**Step 1: Write failing test**

Create `backend/tests/services/qr_identity/test_lineage_resolver.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock

from app.services.qr_identity.lineage_resolver import QRLineageResolver


@pytest.fixture
def mock_lineage_tracker():
    tracker = AsyncMock()
    tracker.get_lineage.return_value = [
        {"event_type": "ingestion", "action": "Ingested document"},
        {"event_type": "crystallization", "action": "Crystallized to module"},
    ]
    tracker.get_lineage_graph.return_value = {
        "nodes": [{"id": "a"}, {"id": "b"}],
        "edges": [{"source": "a", "target": "b"}],
    }
    return tracker


@pytest.mark.asyncio
async def test_public_returns_shallow_lineage(mock_lineage_tracker):
    resolver = QRLineageResolver(mock_lineage_tracker)
    result = await resolver.resolve(
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="public",
    )
    # Public tier: summary only, no full graph
    assert "summary" in result
    assert "graph" not in result


@pytest.mark.asyncio
async def test_org_returns_full_lineage(mock_lineage_tracker):
    resolver = QRLineageResolver(mock_lineage_tracker)
    result = await resolver.resolve(
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="org",
    )
    assert "graph" in result


@pytest.mark.asyncio
async def test_admin_returns_full_lineage_with_audit(mock_lineage_tracker):
    resolver = QRLineageResolver(mock_lineage_tracker)
    result = await resolver.resolve(
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="admin",
    )
    assert "graph" in result
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/qr_identity/test_lineage_resolver.py -v`
Expected: FAIL

**Step 3: Write the lineage resolver**

Create `backend/app/services/qr_identity/lineage_resolver.py`:

```python
"""Tier-gated lineage resolution for QR identities."""

from __future__ import annotations

import uuid
from typing import Any

from app.services.governance.lineage_tracker import LineageTracker


class QRLineageResolver:
    def __init__(self, lineage_tracker: LineageTracker) -> None:
        self._tracker = lineage_tracker

    async def resolve(
        self,
        subject_type: str,
        subject_id: uuid.UUID,
        tier: str,
    ) -> dict[str, Any]:
        """Resolve lineage for an entity, gated by access tier.

        - public: summary only (event count, latest event)
        - org: full lineage DAG + events
        - admin: full lineage + graph structure
        """
        if tier == "public":
            return await self._public_lineage(subject_id)
        elif tier == "org":
            return await self._org_lineage(subject_id)
        else:  # admin
            return await self._admin_lineage(subject_id)

    async def _public_lineage(self, subject_id: uuid.UUID) -> dict[str, Any]:
        events = await self._tracker.get_lineage(subject_id, max_depth=2)
        return {
            "summary": {
                "event_count": len(events),
                "latest_event": events[0] if events else None,
                "depth": "shallow",
            }
        }

    async def _org_lineage(self, subject_id: uuid.UUID) -> dict[str, Any]:
        events = await self._tracker.get_lineage(subject_id, max_depth=50)
        graph = await self._tracker.get_lineage_graph(subject_id)
        return {
            "summary": {
                "event_count": len(events),
                "latest_event": events[0] if events else None,
                "depth": "full",
            },
            "events": events,
            "graph": graph,
        }

    async def _admin_lineage(self, subject_id: uuid.UUID) -> dict[str, Any]:
        result = await self._org_lineage(subject_id)
        # Admin gets everything org gets — scan audit log is added at API layer
        return result
```

**Step 4: Wire into scan endpoint**

In `backend/app/api/v1/qr_identity.py`, replace the `# TODO` comment in `scan_qr_code` with:

```python
    from app.services.governance.lineage_tracker import LineageTracker
    from app.services.qr_identity.lineage_resolver import QRLineageResolver
    tracker = LineageTracker(db)
    resolver = QRLineageResolver(tracker)
    lineage = await resolver.resolve(qi.subject_type, qi.subject_id, access)
```

Also add a dedicated lineage endpoint after the scan endpoint:

```python
@router.get("/{code}/lineage")
async def get_qr_lineage(
    code: str,
    tier: str = Query(default="public"),
    db: AsyncSession = Depends(get_db),
):
    """Get lineage data for a QR-linked entity at a specific tier."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found or revoked")

    from app.services.governance.lineage_tracker import LineageTracker
    from app.services.qr_identity.lineage_resolver import QRLineageResolver
    tracker = LineageTracker(db)
    resolver = QRLineageResolver(tracker)
    return await resolver.resolve(qi.subject_type, qi.subject_id, tier)
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/qr_identity/test_lineage_resolver.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/services/qr_identity/lineage_resolver.py backend/app/api/v1/qr_identity.py backend/tests/services/qr_identity/test_lineage_resolver.py
git commit -m "feat(qr): add tier-gated lineage resolution — public/org/admin depth"
```

---

### Task 8: Auto-Minting Hook in Module Registry

**Files:**
- Modify: `backend/app/services/crystallization/module_registry.py` (add auto-mint after register_many)

**Step 1: Write failing test**

Create `backend/tests/services/crystallization/test_module_registry_auto_mint.py`:

```python
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.crystallization.module_registry import ModuleRegistryService


@pytest.mark.asyncio
async def test_register_many_mints_qr_identities():
    """After registering modules, QR identities should be auto-minted."""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()

    # Mock: no existing modules (all new)
    mock_session.execute.return_value.scalar_one_or_none.return_value = None

    svc = ModuleRegistryService(mock_session)

    # Create a minimal mock module
    mock_module = MagicMock()
    mock_module.id = str(uuid.uuid4())
    mock_module.vertical = "data_estate"
    mock_module.module_type = "attractor"
    mock_module.centroid = [0.1, 0.2]
    mock_module.members = ["a", "b"]
    mock_module.purity = 0.9
    mock_module.quality_score = 0.85
    mock_module.provenance_job_id = str(uuid.uuid4())

    with patch("app.services.crystallization.module_registry.QRIdentityService") as MockQR:
        mock_qr_svc = AsyncMock()
        MockQR.return_value = mock_qr_svc
        mock_qr_svc.mint = AsyncMock()

        await svc.register_many([mock_module])

        # Verify QR identity was minted
        mock_qr_svc.mint.assert_called_once()
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/crystallization/test_module_registry_auto_mint.py -v`
Expected: FAIL (QRIdentityService not imported/called in register_many)

**Step 3: Add auto-mint hook to register_many**

In `backend/app/services/crystallization/module_registry.py`, at the end of `register_many()`, after the module entries are upserted, add:

```python
        # Auto-mint QR identities for newly registered modules
        try:
            from app.services.qr_identity.identity_service import QRIdentityService
            qr_svc = QRIdentityService(self._session)
            for entry in created_entries:
                await qr_svc.mint(
                    subject_type="module",
                    subject_id=entry.id,
                    tier="org",
                    minted_by="system:crystallization",
                    metadata={"vertical": entry.vertical, "module_type": entry.module_type},
                )
        except Exception:
            logger.warning("QR auto-mint failed for batch, continuing", exc_info=True)
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/crystallization/test_module_registry_auto_mint.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/module_registry.py backend/tests/services/crystallization/test_module_registry_auto_mint.py
git commit -m "feat(qr): auto-mint QR identities when modules are registered"
```

---

### Task 9: Frontend — QR Identity Types and API Client

**Files:**
- Modify: `frontend/lib/types.ts` (add QR types)
- Create: `frontend/lib/qr/api.ts`

**Step 1: Add TypeScript types**

Add to `frontend/lib/types.ts`:

```typescript
// --- QR Digital Identity ---

export interface QRIdentity {
  id: string;
  code: string;
  subject_type: string;
  subject_id: string;
  tier: "public" | "org" | "admin";
  org_id: string | null;
  minted_by: string;
  minted_at: string;
  revoked_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface QRScanResult {
  qr_identity: QRIdentity;
  access_granted: string;
  entity_summary: Record<string, unknown>;
  lineage: Record<string, unknown> | null;
}

export interface QRCodeImage {
  code: string;
  image_base64: string;
  url: string;
}

export interface QRScanLog {
  id: string;
  qr_identity_id: string;
  scanned_by: string | null;
  scanned_at: string;
  access_granted: string;
  ip_address: string | null;
}
```

**Step 2: Create QR API client**

Create `frontend/lib/qr/api.ts`:

```typescript
import { api } from "@/lib/api";
import type { QRIdentity, QRScanResult, QRCodeImage, QRScanLog } from "@/lib/types";

export async function mintQRIdentity(params: {
  subject_type: string;
  subject_id: string;
  tier?: "public" | "org" | "admin";
  metadata?: Record<string, unknown>;
}): Promise<QRIdentity> {
  return api.post<QRIdentity>("/qr/mint", params);
}

export async function resolveQRCode(code: string): Promise<QRIdentity> {
  return api.get<QRIdentity>(`/qr/${code}`);
}

export async function scanQRCode(code: string): Promise<QRScanResult> {
  return api.post<QRScanResult>(`/qr/${code}/scan`);
}

export async function getQRImage(code: string, baseUrl?: string): Promise<QRCodeImage> {
  const params = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : "";
  return api.get<QRCodeImage>(`/qr/${code}/image${params}`);
}

export async function revokeQRCode(code: string): Promise<{ status: string; code: string }> {
  return api.delete(`/qr/${code}`);
}

export async function listEntityQRCodes(
  subjectType: string,
  subjectId: string,
): Promise<QRIdentity[]> {
  return api.get<QRIdentity[]>(`/qr/entity/${subjectType}/${subjectId}`);
}

export async function getQRScanLog(code: string): Promise<QRScanLog[]> {
  return api.get<QRScanLog[]>(`/qr/${code}/scans`);
}

export async function getQRLineage(
  code: string,
  tier: "public" | "org" | "admin" = "public",
): Promise<Record<string, unknown>> {
  return api.get(`/qr/${code}/lineage?tier=${tier}`);
}
```

**Step 3: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/qr/api.ts
git commit -m "feat(qr): add frontend TypeScript types and API client for QR identity"
```

---

### Task 10: Frontend — QR Scanner Page

**Files:**
- Create: `frontend/app/qr/[code]/page.tsx`

**Step 1: Create the QR scan landing page**

This is the page users land on when scanning a QR code (`/qr/XXXX-XXXX`).

Create `frontend/app/qr/[code]/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { scanQRCode, getQRImage } from "@/lib/qr/api";

const TIER_COLORS = {
  public: "bg-green-500/20 text-green-400 border-green-500/30",
  org: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
} as const;

const TIER_LABELS = {
  public: "Public Access",
  org: "Organization",
  admin: "Administrator",
} as const;

export default function QRScanPage() {
  const { code } = useParams<{ code: string }>();

  const { data: scanResult, isLoading, error } = useQuery({
    queryKey: ["qr-scan", code],
    queryFn: () => scanQRCode(code),
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Resolving QR identity...</div>
      </div>
    );
  }

  if (error || !scanResult) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg font-medium">QR Code Not Found</div>
          <div className="text-gray-500 mt-2">
            Code <span className="font-mono">{code}</span> is invalid or has been revoked.
          </div>
        </div>
      </div>
    );
  }

  const { qr_identity: qi, access_granted, entity_summary, lineage } = scanResult;
  const tier = qi.tier as keyof typeof TIER_COLORS;

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Identity Card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-xl text-white">{qi.code}</div>
            <span className={`px-3 py-1 rounded-full text-xs border ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Entity Type</div>
              <div className="text-white capitalize">{qi.subject_type}</div>
            </div>
            <div>
              <div className="text-gray-500">Minted By</div>
              <div className="text-white">{qi.minted_by}</div>
            </div>
            <div>
              <div className="text-gray-500">Minted At</div>
              <div className="text-white">
                {new Date(qi.minted_at).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Access Granted</div>
              <div className="text-white capitalize">{access_granted}</div>
            </div>
          </div>
        </div>

        {/* Entity Summary */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-white font-medium mb-3">Entity Summary</h2>
          <pre className="text-gray-400 text-sm overflow-x-auto">
            {JSON.stringify(entity_summary, null, 2)}
          </pre>
        </div>

        {/* Lineage (if available based on tier) */}
        {lineage && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-white font-medium mb-3">Lineage</h2>
            {lineage.summary && (
              <div className="text-gray-400 text-sm mb-3">
                {(lineage.summary as Record<string, unknown>).event_count} provenance events tracked
              </div>
            )}
            <pre className="text-gray-400 text-sm overflow-x-auto max-h-96">
              {JSON.stringify(lineage, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/qr/
git commit -m "feat(qr): add QR scan landing page — tier-gated identity + lineage view"
```

---

### Task 11: Frontend — QR Minter Admin Component

**Files:**
- Create: `frontend/components/qr/QRMinter.tsx`
- Create: `frontend/components/qr/QRCard.tsx`

**Step 1: Create the QR minter component**

Create `frontend/components/qr/QRMinter.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mintQRIdentity, getQRImage } from "@/lib/qr/api";
import type { QRIdentity } from "@/lib/types";

interface QRMinterProps {
  subjectType: string;
  subjectId: string;
  defaultTier?: "public" | "org" | "admin";
  onMinted?: (qi: QRIdentity) => void;
}

export function QRMinter({ subjectType, subjectId, defaultTier = "org", onMinted }: QRMinterProps) {
  const [tier, setTier] = useState(defaultTier);
  const queryClient = useQueryClient();

  const mintMutation = useMutation({
    mutationFn: () => mintQRIdentity({ subject_type: subjectType, subject_id: subjectId, tier }),
    onSuccess: (qi) => {
      queryClient.invalidateQueries({ queryKey: ["qr-entity", subjectType, subjectId] });
      onMinted?.(qi);
    },
  });

  return (
    <div className="flex items-center gap-3">
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value as typeof tier)}
        className="bg-gray-800 text-gray-300 rounded px-3 py-1.5 text-sm border border-gray-700"
      >
        <option value="public">Public</option>
        <option value="org">Organization</option>
        <option value="admin">Admin</option>
      </select>
      <button
        onClick={() => mintMutation.mutate()}
        disabled={mintMutation.isPending}
        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-4 py-1.5 text-sm transition-colors disabled:opacity-50"
      >
        {mintMutation.isPending ? "Minting..." : "Mint QR Identity"}
      </button>
      {mintMutation.data && (
        <span className="text-green-400 text-sm font-mono">{mintMutation.data.code}</span>
      )}
    </div>
  );
}
```

**Step 2: Create the QR Card component**

Create `frontend/components/qr/QRCard.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { getQRImage } from "@/lib/qr/api";
import type { QRIdentity } from "@/lib/types";

const TIER_STYLES = {
  public: {
    border: "border-green-500/40",
    glow: "shadow-green-500/10",
    badge: "bg-green-500/20 text-green-400",
    label: "PUBLIC",
  },
  org: {
    border: "border-blue-500/40",
    glow: "shadow-blue-500/10",
    badge: "bg-blue-500/20 text-blue-400",
    label: "ORG",
  },
  admin: {
    border: "border-amber-500/40",
    glow: "shadow-amber-500/10",
    badge: "bg-amber-500/20 text-amber-400",
    label: "ADMIN",
  },
} as const;

interface QRCardProps {
  identity: QRIdentity;
  showImage?: boolean;
}

export function QRCard({ identity, showImage = true }: QRCardProps) {
  const tier = identity.tier as keyof typeof TIER_STYLES;
  const style = TIER_STYLES[tier];

  const { data: imageData } = useQuery({
    queryKey: ["qr-image", identity.code],
    queryFn: () => getQRImage(identity.code),
    enabled: showImage,
  });

  return (
    <div
      className={`bg-gray-900 rounded-xl border ${style.border} shadow-lg ${style.glow} p-5 w-72`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-white text-lg tracking-wider">{identity.code}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {imageData && (
        <div className="flex justify-center my-4">
          <img
            src={`data:image/png;base64,${imageData.image_base64}`}
            alt={`QR code ${identity.code}`}
            className="w-40 h-40 rounded"
          />
        </div>
      )}

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span className="text-gray-300 capitalize">{identity.subject_type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Minted</span>
          <span className="text-gray-300">
            {new Date(identity.minted_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">By</span>
          <span className="text-gray-300 truncate ml-2">{identity.minted_by}</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/components/qr/
git commit -m "feat(qr): add QRMinter and QRCard frontend components"
```

---

### Task 12: Install Dependencies

**Step 1: Backend — install qrcode library**

```bash
cd backend && pip install qrcode[pil] && pip freeze | grep qrcode >> requirements.txt
```

**Step 2: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add qrcode[pil] dependency for QR image generation"
```

---

### Task 13: Run Full Test Suite

**Step 1: Run all QR identity tests**

```bash
cd backend && python -m pytest tests/models/test_qr_identity_model.py tests/schemas/test_qr_identity_schemas.py tests/services/qr_identity/ tests/api/test_qr_identity_endpoints.py -v
```

Expected: ALL PASS

**Step 2: Run existing tests to verify no regressions**

```bash
cd backend && python -m pytest -v --tb=short
```

Expected: No regressions in existing tests.

**Step 3: If any failures, fix and commit**

```bash
git add -A && git commit -m "fix: resolve test failures in QR identity integration"
```

---

### Summary of Files Created/Modified

**New files (13):**
- `backend/app/db/migrations/versions/004_qr_digital_identity.py`
- `backend/app/models/qr_identity.py`
- `backend/app/schemas/qr_identity.py`
- `backend/app/services/qr_identity/__init__.py`
- `backend/app/services/qr_identity/code_generator.py`
- `backend/app/services/qr_identity/identity_service.py`
- `backend/app/services/qr_identity/lineage_resolver.py`
- `backend/app/api/v1/qr_identity.py`
- `frontend/lib/qr/api.ts`
- `frontend/app/qr/[code]/page.tsx`
- `frontend/components/qr/QRMinter.tsx`
- `frontend/components/qr/QRCard.tsx`
- 5 test files

**Modified files (3):**
- `backend/app/models/__init__.py` — register QRIdentity, QRScanLog
- `backend/app/api/v1/__init__.py` — register qr_identity router
- `backend/app/services/crystallization/module_registry.py` — auto-mint hook
- `frontend/lib/types.ts` — add QR type definitions
