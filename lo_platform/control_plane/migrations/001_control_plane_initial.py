"""Control plane initial migration.

Creates tables: plans, customers, forks, usage_events

Revision ID: 001_control_plane
Revises: None
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSON

# Revision identifiers
revision = "001_control_plane"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── plans ────────────────────────────────────────────────────────
    op.create_table(
        "plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        # Limits
        sa.Column(
            "max_forks", sa.Integer, server_default="1"
        ),
        sa.Column(
            "max_entities_per_fork", sa.Integer, server_default="100000"
        ),
        sa.Column(
            "max_queries_per_month", sa.Integer, server_default="10000"
        ),
        sa.Column(
            "max_storage_bytes",
            sa.Integer,
            server_default=str(10 * 1024**3),
        ),
        sa.Column(
            "max_reductions_per_day", sa.Integer, server_default="4"
        ),
        # Engine defaults
        sa.Column(
            "default_budget", sa.Float, server_default="50.0"
        ),
        sa.Column(
            "default_target_survivors", sa.Integer, server_default="300"
        ),
        # Pricing
        sa.Column(
            "price_monthly_cents", sa.Integer, server_default="0"
        ),
        sa.Column(
            "price_per_entity_cents", sa.Float, server_default="0.0"
        ),
        sa.Column(
            "price_per_query_cents", sa.Float, server_default="0.0"
        ),
        sa.Column(
            "stripe_price_id", sa.String(255), server_default=""
        ),
        # Feature flags
        sa.Column("features", JSON, server_default="{}"),
        # Lifecycle
        sa.Column(
            "is_active",
            sa.Boolean,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime,
            server_default=sa.text("now()"),
        ),
    )

    # ── customers ────────────────────────────────────────────────────
    op.create_table(
        "customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("organization", sa.String(255), server_default=""),
        # Plan FK
        sa.Column(
            "plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("plans.id"),
            nullable=True,
        ),
        # Billing
        sa.Column(
            "stripe_customer_id", sa.String(255), server_default=""
        ),
        sa.Column(
            "stripe_subscription_id", sa.String(255), server_default=""
        ),
        sa.Column(
            "billing_email", sa.String(255), server_default=""
        ),
        # Status
        sa.Column(
            "status",
            sa.String(20),
            server_default="active",
            comment="active | suspended | churned",
        ),
        # Metadata
        sa.Column(
            "settings",
            JSON,
            server_default="{}",
            comment="Customer-level settings and preferences",
        ),
        # API access
        sa.Column(
            "api_key_hash",
            sa.String(255),
            server_default="",
            comment="Hashed API key for programmatic access",
        ),
        # Lifecycle
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_login_at", sa.DateTime, nullable=True),
    )

    op.create_index("idx_customers_status", "customers", ["status"])
    op.create_index("idx_customers_plan", "customers", ["plan_id"])

    # ── forks ────────────────────────────────────────────────────────
    op.create_table(
        "forks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id", UUID(as_uuid=True), nullable=False, index=True
        ),
        sa.Column(
            "subdomain",
            sa.String(63),
            unique=True,
            nullable=False,
            comment="e.g. 'acme' for acme.latentocean.io",
        ),
        sa.Column(
            "display_name",
            sa.String(255),
            server_default="",
            comment="Human-friendly name for the fork",
        ),
        # Status
        sa.Column(
            "status",
            sa.String(20),
            server_default="provisioning",
            nullable=False,
            index=True,
            comment="provisioning | active | suspended | teardown",
        ),
        # Database connections
        sa.Column(
            "source_connection_string",
            sa.Text,
            nullable=False,
            comment="Customer's source database DSN (encrypted at rest)",
        ),
        sa.Column(
            "output_connection_string",
            sa.Text,
            nullable=True,
            comment="Where to write lo_* tables; defaults to source if null",
        ),
        sa.Column(
            "output_schema",
            sa.String(63),
            server_default="latent_ocean",
        ),
        # Infrastructure
        sa.Column(
            "container_id",
            sa.String(255),
            nullable=True,
            comment="Docker container ID or K8s pod name",
        ),
        sa.Column(
            "assigned_host",
            sa.String(255),
            nullable=True,
            comment="Host machine or node running this fork",
        ),
        sa.Column(
            "api_port",
            sa.Integer,
            nullable=True,
            comment="Mapped port for the fork's FastAPI server",
        ),
        sa.Column(
            "dashboard_port",
            sa.Integer,
            nullable=True,
            comment="Mapped port for the fork's Next.js dashboard",
        ),
        # Engine configuration
        sa.Column(
            "engine_config",
            JSON,
            server_default="{}",
            comment="EngineConfig overrides (budget, target_survivors, etc.)",
        ),
        sa.Column(
            "enabled_modules",
            ARRAY(sa.String),
            server_default="{}",
            comment="List of enabled engine modules",
        ),
        sa.Column(
            "reduction_schedule",
            sa.String(100),
            server_default="0 2 * * *",
            comment="Cron expression for scheduled reductions",
        ),
        # Metering
        sa.Column(
            "entity_count",
            sa.Integer,
            server_default="0",
            comment="Total entities in the customer's source database",
        ),
        sa.Column(
            "survivor_count",
            sa.Integer,
            server_default="0",
            comment="Current number of survivors after reduction",
        ),
        sa.Column(
            "last_reduction_at",
            sa.DateTime,
            nullable=True,
            comment="Timestamp of the last successful reduction",
        ),
        sa.Column(
            "last_reduction_seconds",
            sa.Float,
            nullable=True,
            comment="Wall time of the last reduction in seconds",
        ),
        sa.Column(
            "queries_served_total",
            sa.Integer,
            server_default="0",
            comment="Total queries served by this fork's API",
        ),
        sa.Column(
            "storage_used_bytes",
            sa.Integer,
            server_default="0",
            comment="Approximate storage used by lo_* tables",
        ),
        # Lifecycle
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "suspended_at",
            sa.DateTime,
            nullable=True,
            comment="When the fork was last suspended",
        ),
        sa.Column(
            "teardown_at",
            sa.DateTime,
            nullable=True,
            comment="When teardown was initiated",
        ),
        # Health
        sa.Column("last_health_check", sa.DateTime, nullable=True),
        sa.Column(
            "health_status",
            sa.String(20),
            server_default="unknown",
            comment="healthy | degraded | unhealthy | unknown",
        ),
        sa.Column(
            "health_score",
            sa.Float,
            server_default="0.0",
            comment="Composite health score 0.0-1.0",
        ),
        sa.Column(
            "error_message",
            sa.Text,
            nullable=True,
            comment="Last error message if unhealthy",
        ),
        sa.Column(
            "consecutive_failures",
            sa.Integer,
            server_default="0",
            comment="Number of consecutive health check failures",
        ),
    )

    # Composite indexes for forks
    op.create_index(
        "idx_forks_customer_status", "forks", ["customer_id", "status"]
    )
    op.create_index(
        "idx_forks_health", "forks", ["health_status", "last_health_check"]
    )

    # ── usage_events ─────────────────────────────────────────────────
    op.create_table(
        "usage_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("customers.id"),
            nullable=False,
        ),
        sa.Column(
            "fork_id",
            UUID(as_uuid=True),
            sa.ForeignKey("forks.id"),
            nullable=False,
        ),
        # Event details
        sa.Column(
            "event_type",
            sa.String(50),
            nullable=False,
            comment="reduction | query | storage | api_call",
        ),
        sa.Column(
            "count",
            sa.Integer,
            server_default="1",
            comment="Number of units (entities reduced, queries served, etc.)",
        ),
        sa.Column(
            "event_metadata",
            JSON,
            server_default="{}",
            comment="Extra event details (e.g. reduction summary)",
        ),
        # Timing
        sa.Column(
            "timestamp",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # Billing
        sa.Column(
            "billed",
            sa.Boolean,
            server_default=sa.text("false"),
            comment="Whether this event has been included in an invoice",
        ),
        sa.Column(
            "invoice_id",
            sa.String(255),
            server_default="",
            comment="Stripe invoice ID once billed",
        ),
    )

    # Indexes for usage_events
    op.create_index(
        "idx_usage_customer_time",
        "usage_events",
        ["customer_id", "timestamp"],
    )
    op.create_index(
        "idx_usage_fork_type",
        "usage_events",
        ["fork_id", "event_type"],
    )
    op.create_index(
        "idx_usage_unbilled",
        "usage_events",
        ["billed", "timestamp"],
    )


def downgrade() -> None:
    op.drop_table("usage_events")
    op.drop_table("forks")
    op.drop_table("customers")
    op.drop_table("plans")
