"""Customer model — billing, plan, and organization info.

Tracks customer organizations, their billing plans, and usage events
for metering. Integrates with Stripe for subscription management.
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
    ForeignKey,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .fork import ControlPlaneBase


class Plan(ControlPlaneBase):
    """Billing plan definition.

    Plans define the resource limits and pricing for a customer's
    Latent Ocean subscription.
    """

    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, default="")

    # Limits
    max_forks = Column(Integer, default=1)
    max_entities_per_fork = Column(Integer, default=100_000)
    max_queries_per_month = Column(Integer, default=10_000)
    max_storage_bytes = Column(Integer, default=10 * 1024**3)  # 10 GB
    max_reductions_per_day = Column(Integer, default=4)

    # Engine defaults
    default_budget = Column(Float, default=50.0)
    default_target_survivors = Column(Integer, default=300)

    # Pricing
    price_monthly_cents = Column(Integer, default=0)
    price_per_entity_cents = Column(Float, default=0.0)
    price_per_query_cents = Column(Float, default=0.0)
    stripe_price_id = Column(String(255), default="")

    # Feature flags
    features = Column(
        JSON,
        default=dict,
        comment="Feature flags: {flow_engine, cross_source_linking, ...}",
    )

    # Lifecycle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Plan name={self.name!r} max_forks={self.max_forks}>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "display_name": self.display_name,
            "max_forks": self.max_forks,
            "max_entities_per_fork": self.max_entities_per_fork,
            "max_queries_per_month": self.max_queries_per_month,
            "max_storage_bytes": self.max_storage_bytes,
            "default_budget": self.default_budget,
            "price_monthly_cents": self.price_monthly_cents,
            "features": self.features or {},
        }


class Customer(ControlPlaneBase):
    """Customer organization.

    Represents a paying customer with one or more forks. Tracks
    billing information, plan association, and organization metadata.
    """

    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    organization = Column(String(255), default="")

    # Plan
    plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plans.id"),
        nullable=True,
    )

    # Billing
    stripe_customer_id = Column(String(255), default="")
    stripe_subscription_id = Column(String(255), default="")
    billing_email = Column(String(255), default="")

    # Status
    status = Column(
        String(20),
        default="active",
        comment="active | suspended | churned",
    )

    # Metadata
    settings = Column(
        JSON,
        default=dict,
        comment="Customer-level settings and preferences",
    )

    # API access
    api_key_hash = Column(
        String(255),
        default="",
        comment="Hashed API key for programmatic access",
    )

    # Lifecycle
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    last_login_at = Column(DateTime)

    # Relationships
    plan = relationship("Plan", lazy="joined")

    __table_args__ = (
        Index("idx_customers_status", "status"),
        Index("idx_customers_plan", "plan_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<Customer id={self.id} name={self.name!r} "
            f"status={self.status!r}>"
        )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "organization": self.organization,
            "plan": self.plan.to_dict() if self.plan else None,
            "status": self.status,
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }


class UsageEvent(ControlPlaneBase):
    """Usage metering event for billing.

    Tracks individual usage events (reductions, queries, storage changes)
    per fork. Aggregated by MeteringService for billing periods.
    """

    __tablename__ = "usage_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
    )
    fork_id = Column(
        UUID(as_uuid=True),
        ForeignKey("forks.id"),
        nullable=False,
    )

    # Event details
    event_type = Column(
        String(50),
        nullable=False,
        comment="reduction | query | storage | api_call",
    )
    count = Column(
        Integer,
        default=1,
        comment="Number of units (entities reduced, queries served, etc.)",
    )
    event_metadata = Column(
        JSON,
        default=dict,
        comment="Extra event details (e.g. reduction summary)",
    )

    # Timing
    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Billing
    billed = Column(
        Boolean,
        default=False,
        comment="Whether this event has been included in an invoice",
    )
    invoice_id = Column(
        String(255),
        default="",
        comment="Stripe invoice ID once billed",
    )

    __table_args__ = (
        Index("idx_usage_customer_time", "customer_id", "timestamp"),
        Index("idx_usage_fork_type", "fork_id", "event_type"),
        Index("idx_usage_unbilled", "billed", "timestamp"),
    )

    def __repr__(self) -> str:
        return (
            f"<UsageEvent type={self.event_type!r} "
            f"fork={self.fork_id} count={self.count}>"
        )
