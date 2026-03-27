import uuid
from datetime import datetime

from sqlalchemy import String, BigInteger, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AuditLog(Base):
    """Append-only audit log. No updates or deletes should be performed on this table."""

    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_search", "timestamp", "actor_id", "action", "resource_type"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(server_default=text("now()"), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    actor_type: Mapped[str | None] = mapped_column(String(50))
    actor_ip: Mapped[str | None] = mapped_column(String(45))
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(100))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    details: Mapped[dict | None] = mapped_column(JSONB)
    result: Mapped[str | None] = mapped_column(String(50))
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
