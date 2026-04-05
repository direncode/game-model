"""BTUT run results model — persists BTUT pipeline outputs in PostgreSQL.

Each row stores a complete BTUT run result for one dataset,
including the summary stats and the full survivor list in JSONB.
The query engine can load from this table instead of JSON files.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Text, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class BTUTRun(Base):
    __tablename__ = "btut_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="completed")  # running/completed/failed

    # Summary stats
    total_entities: Mapped[int] = mapped_column(Integer, default=0)
    total_clusters: Mapped[int] = mapped_column(Integer, default=0)
    total_fingerprints: Mapped[int] = mapped_column(Integer, default=0)
    survivor_count: Mapped[int] = mapped_column(Integer, default=0)
    reduction_ratio: Mapped[int] = mapped_column(Integer, default=0)
    variance_preservation: Mapped[float | None] = mapped_column(Float)
    wall_seconds: Mapped[float | None] = mapped_column(Float)

    # Full result data
    summary: Mapped[dict | None] = mapped_column(JSONB)  # The summary section
    survivors: Mapped[list | None] = mapped_column(JSONB)  # The survivors list (can be large)

    # Metadata
    triggered_by: Mapped[str | None] = mapped_column(String(100))  # "celery", "cli", "api"
    celery_task_id: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    completed_at: Mapped[datetime | None] = mapped_column()
