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
