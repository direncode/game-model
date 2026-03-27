import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crystallization_jobs.id"), nullable=False)
    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    generated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(100), nullable=False)
    conditions: Mapped[dict | None] = mapped_column(JSONB)
    delivery_method: Mapped[str] = mapped_column(String(50), nullable=False)
    delivery_config: Mapped[dict | None] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    events: Mapped[list["AlertEvent"]] = relationship(back_populates="rule")


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("alert_rules.id"), nullable=False)
    triggered_by_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crystallization_jobs.id"), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    delivered_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    rule: Mapped[AlertRule] = relationship(back_populates="events")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    permissions: Mapped[dict | None] = mapped_column(JSONB)
    last_used_at: Mapped[datetime | None] = mapped_column()
    expires_at: Mapped[datetime | None] = mapped_column()
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
