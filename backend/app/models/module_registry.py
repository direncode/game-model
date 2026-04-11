"""Persistent registry of crystallized modules.

Distinct from `models/module.py` (which is per-job module records tied to
a specific CrystallizationJob). This table is cross-job, cross-vertical,
the system of record for every routable module that has ever survived
quality gating.

Schema is additive — a new migration adds this table; nothing else touches it.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ModuleRegistryEntry(Base):
    """A crystallized module registered to the TCD-JEPA vertical."""

    __tablename__ = "module_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    vertical: Mapped[str] = mapped_column(String(32), nullable=False)
    module_type: Mapped[str] = mapped_column(String(32), nullable=False)
    module_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Vector state — stored as JSONB (not vector extension) to keep the
    # migration additive and Postgres-extension-free.
    centroid: Mapped[list[float]] = mapped_column(JSONB, nullable=False)
    members: Mapped[list[str]] = mapped_column(JSONB, nullable=False)

    purity: Mapped[float] = mapped_column(Float, nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, nullable=False)

    provenance_job_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    __table_args__ = (
        Index(
            "uq_module_registry_provenance_hash",
            "provenance_job_id",
            "module_hash",
            unique=True,
        ),
        Index("ix_module_registry_vertical", "vertical"),
        Index("ix_module_registry_quality", "quality_score"),
    )
