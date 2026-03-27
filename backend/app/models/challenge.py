import uuid
from datetime import datetime

from sqlalchemy import String, Float, Boolean, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crystallization_jobs.id"), nullable=False)
    challenge_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    challenger_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict | None] = mapped_column(JSONB)
    proposed_resolution: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(50), default="open")  # open/under_review/accepted/rejected/deferred
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolution_reasoning: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column()
    impact_analysis: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    comments: Mapped[list["ChallengeComment"]] = relationship(back_populates="challenge")


class ChallengeComment(Base):
    __tablename__ = "challenge_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("challenges.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    challenge: Mapped[Challenge] = relationship(back_populates="comments")


class FeedbackConstraint(Base):
    __tablename__ = "feedback_constraints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    constraint_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entities: Mapped[dict | None] = mapped_column(JSONB)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    source_challenge_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("challenges.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
