"""Fork model — represents a customer's dedicated Latent Ocean instance.

Each fork is an isolated container running the Latent Ocean engine against
a customer's database. The Fork model tracks the full lifecycle from
provisioning through active use to teardown, including infrastructure
details, engine configuration, metering counters, and health status.

States:
    provisioning -> active -> suspended -> teardown
                     |            |
                     +-----<------+  (resume)
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    JSON,
    Boolean,
    Text,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import declarative_base

ControlPlaneBase = declarative_base()


class Fork(ControlPlaneBase):
    """A customer's dedicated Latent Ocean instance.

    Each fork maps to:
    - A running container (Docker or K8s pod)
    - A subdomain (e.g. acme.latentocean.io)
    - A source database (customer's data)
    - An output database/schema (lo_* tables)
    """

    __tablename__ = "forks"

    # ── Identity ──────────────────────────────────────────────────────

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    customer_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    subdomain = Column(
        String(63),
        unique=True,
        nullable=False,
        comment="e.g. 'acme' for acme.latentocean.io",
    )
    display_name = Column(
        String(255),
        default="",
        comment="Human-friendly name for the fork",
    )

    # ── Status ────────────────────────────────────────────────────────

    status = Column(
        String(20),
        default="provisioning",
        nullable=False,
        index=True,
        comment="provisioning | active | suspended | teardown",
    )

    # ── Customer's database connections ───────────────────────────────

    source_connection_string = Column(
        Text,
        nullable=False,
        comment="Customer's source database DSN (encrypted at rest)",
    )
    output_connection_string = Column(
        Text,
        nullable=True,
        comment="Where to write lo_* tables; defaults to source if null",
    )
    output_schema = Column(
        String(63),
        default="latent_ocean",
    )

    # ── Infrastructure ────────────────────────────────────────────────

    container_id = Column(
        String(255),
        comment="Docker container ID or K8s pod name",
    )
    assigned_host = Column(
        String(255),
        comment="Host machine or node running this fork",
    )
    api_port = Column(
        Integer,
        comment="Mapped port for the fork's FastAPI server",
    )
    dashboard_port = Column(
        Integer,
        comment="Mapped port for the fork's Next.js dashboard",
    )

    # ── Engine configuration ──────────────────────────────────────────

    engine_config = Column(
        JSON,
        default=dict,
        comment="EngineConfig overrides (budget, target_survivors, etc.)",
    )
    enabled_modules = Column(
        ARRAY(String),
        default=list,
        comment="List of enabled engine modules",
    )
    reduction_schedule = Column(
        String(100),
        default="0 2 * * *",
        comment="Cron expression for scheduled reductions",
    )

    # ── Metering ──────────────────────────────────────────────────────

    entity_count = Column(
        Integer,
        default=0,
        comment="Total entities in the customer's source database",
    )
    survivor_count = Column(
        Integer,
        default=0,
        comment="Current number of survivors after reduction",
    )
    last_reduction_at = Column(
        DateTime,
        comment="Timestamp of the last successful reduction",
    )
    last_reduction_seconds = Column(
        Float,
        comment="Wall time of the last reduction in seconds",
    )
    queries_served_total = Column(
        Integer,
        default=0,
        comment="Total queries served by this fork's API",
    )
    storage_used_bytes = Column(
        Integer,
        default=0,
        comment="Approximate storage used by lo_* tables",
    )

    # ── Lifecycle ─────────────────────────────────────────────────────

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    suspended_at = Column(
        DateTime,
        comment="When the fork was last suspended",
    )
    teardown_at = Column(
        DateTime,
        comment="When teardown was initiated",
    )

    # ── Health ────────────────────────────────────────────────────────

    last_health_check = Column(DateTime)
    health_status = Column(
        String(20),
        default="unknown",
        comment="healthy | degraded | unhealthy | unknown",
    )
    health_score = Column(
        Float,
        default=0.0,
        comment="Composite health score 0.0-1.0",
    )
    error_message = Column(
        Text,
        comment="Last error message if unhealthy",
    )
    consecutive_failures = Column(
        Integer,
        default=0,
        comment="Number of consecutive health check failures",
    )

    # ── Table-level indexes ───────────────────────────────────────────

    __table_args__ = (
        Index("idx_forks_customer_status", "customer_id", "status"),
        Index("idx_forks_health", "health_status", "last_health_check"),
    )

    def __repr__(self) -> str:
        return (
            f"<Fork id={self.id} subdomain={self.subdomain!r} "
            f"status={self.status!r}>"
        )

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    @property
    def output_dsn(self) -> str:
        """Effective output DSN — falls back to source if not set."""
        return self.output_connection_string or self.source_connection_string

    def to_dict(self) -> dict:
        """Serialize to dict for API responses."""
        return {
            "id": str(self.id),
            "customer_id": str(self.customer_id),
            "subdomain": self.subdomain,
            "display_name": self.display_name,
            "status": self.status,
            "output_schema": self.output_schema,
            "entity_count": self.entity_count,
            "survivor_count": self.survivor_count,
            "last_reduction_at": (
                self.last_reduction_at.isoformat()
                if self.last_reduction_at
                else None
            ),
            "queries_served_total": self.queries_served_total,
            "storage_used_bytes": self.storage_used_bytes,
            "health_status": self.health_status,
            "health_score": self.health_score,
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "updated_at": (
                self.updated_at.isoformat() if self.updated_at else None
            ),
            "engine_config": self.engine_config or {},
            "enabled_modules": self.enabled_modules or [],
            "reduction_schedule": self.reduction_schedule,
        }
