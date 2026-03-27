import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class LineageEvent(Base):
    __tablename__ = "lineage_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(100), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    inputs: Mapped[dict | None] = mapped_column(JSONB)
    outputs: Mapped[dict | None] = mapped_column(JSONB)
    parameters: Mapped[dict | None] = mapped_column(JSONB)
    parent_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lineage_events.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    parent_event: Mapped["LineageEvent | None"] = relationship(remote_side="LineageEvent.id")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(50), primary_key=True)
    dataset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), primary_key=True, nullable=True)
    granted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class DataClassification(Base):
    __tablename__ = "data_classifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    classification: Mapped[str] = mapped_column(String(50), nullable=False)
    classified_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reasoning: Mapped[str | None] = mapped_column(Text)
    classified_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
