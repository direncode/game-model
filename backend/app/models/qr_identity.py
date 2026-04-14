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
