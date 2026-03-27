import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, BigInteger, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CrystallizationJob(Base):
    __tablename__ = "crystallization_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued")  # queued/running/completed/failed/cancelled
    config: Mapped[dict | None] = mapped_column(JSONB)
    started_at: Mapped[datetime | None] = mapped_column()
    completed_at: Mapped[datetime | None] = mapped_column()
    final_link_auc: Mapped[float | None] = mapped_column(Float)
    final_knn_accuracy: Mapped[float | None] = mapped_column(Float)
    module_count: Mapped[int | None] = mapped_column(Integer)
    training_log: Mapped[dict | None] = mapped_column(JSONB)
    checkpoint_path: Mapped[str | None] = mapped_column(String(500))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    training_metrics: Mapped[list["TrainingMetric"]] = relationship(back_populates="job")


class TrainingMetric(Base):
    __tablename__ = "training_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("crystallization_jobs.id"), nullable=False)
    epoch: Mapped[int] = mapped_column(Integer, nullable=False)
    step: Mapped[int] = mapped_column(Integer, nullable=False)
    loss: Mapped[float] = mapped_column(Float, nullable=False)
    link_auc: Mapped[float | None] = mapped_column(Float)
    knn_accuracy: Mapped[float | None] = mapped_column(Float)
    nan_detected: Mapped[bool | None] = mapped_column(Boolean)
    gpu_utilization: Mapped[float | None] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    job: Mapped[CrystallizationJob] = relationship(back_populates="training_metrics")
