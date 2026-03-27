"""Initial schema for Latent Intelligence platform.

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. organizations
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False),
        sa.Column("plan", sa.String(50), server_default="starter"),
        sa.Column("max_datasets", sa.Integer, server_default="5"),
        sa.Column("max_entities", sa.Integer, server_default="10000"),
        sa.Column("max_users", sa.Integer, server_default="5"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 2. users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("role", sa.String(50), server_default="viewer"),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=True,
        ),
        sa.Column("mfa_enabled", sa.Boolean, server_default="false"),
        sa.Column("mfa_secret", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_login_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # 3. sessions
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 4. datasets
    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(50), server_default="uploading"),
        sa.Column("entity_count", sa.Integer, nullable=True),
        sa.Column("edge_count", sa.Integer, nullable=True),
        sa.Column("density", sa.Float, nullable=True),
        sa.Column("raw_storage_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 5. entity_types
    op.create_table(
        "entity_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("count", sa.Integer, nullable=True),
        sa.Column("attributes", postgresql.JSONB, nullable=True),
    )

    # 6. relationship_types
    op.create_table(
        "relationship_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "source_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entity_types.id"),
            nullable=False,
        ),
        sa.Column(
            "target_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entity_types.id"),
            nullable=False,
        ),
        sa.Column("count", sa.Integer, nullable=True),
    )

    # 7. ingestion_logs
    op.create_table(
        "ingestion_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column(
            "performed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("performed_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 8. crystallization_jobs
    op.create_table(
        "crystallization_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(50), server_default="queued"),
        sa.Column("config", postgresql.JSONB, nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("final_link_auc", sa.Float, nullable=True),
        sa.Column("final_knn_accuracy", sa.Float, nullable=True),
        sa.Column("module_count", sa.Integer, nullable=True),
        sa.Column("training_log", postgresql.JSONB, nullable=True),
        sa.Column("checkpoint_path", sa.String(500), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 9. training_metrics
    op.create_table(
        "training_metrics",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crystallization_jobs.id"),
            nullable=False,
        ),
        sa.Column("epoch", sa.Integer, nullable=False),
        sa.Column("step", sa.Integer, nullable=False),
        sa.Column("loss", sa.Float, nullable=False),
        sa.Column("link_auc", sa.Float, nullable=True),
        sa.Column("knn_accuracy", sa.Float, nullable=True),
        sa.Column("nan_detected", sa.Boolean, nullable=True),
        sa.Column("gpu_utilization", sa.Float, nullable=True),
        sa.Column("recorded_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 10. modules
    op.create_table(
        "modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crystallization_jobs.id"),
            nullable=False,
        ),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("module_index", sa.Integer, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("entity_count", sa.Integer, nullable=True),
        sa.Column("dominant_type", sa.String(255), nullable=True),
        sa.Column("purity_score", sa.Float, nullable=True),
        sa.Column("type_distribution", postgresql.JSONB, nullable=True),
        sa.Column("anchor_entities", postgresql.JSONB, nullable=True),
        sa.Column("internal_density", sa.Float, nullable=True),
        sa.Column("confidence", sa.String(20), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 11. module_entities
    op.create_table(
        "module_entities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "module_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modules.id"),
            nullable=False,
        ),
        sa.Column("entity_name", sa.String(500), nullable=False),
        sa.Column("entity_type", sa.String(255), nullable=False),
        sa.Column("attributes", postgresql.JSONB, nullable=True),
        sa.Column("centrality_score", sa.Float, nullable=True),
    )

    # 12. hidden_connections
    op.create_table(
        "hidden_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crystallization_jobs.id"),
            nullable=False,
        ),
        sa.Column("source_entity", sa.String(500), nullable=False),
        sa.Column("target_entity", sa.String(500), nullable=False),
        sa.Column(
            "source_module_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modules.id"),
            nullable=False,
        ),
        sa.Column(
            "target_module_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modules.id"),
            nullable=False,
        ),
        sa.Column("similarity_score", sa.Float, nullable=False),
        sa.Column("has_direct_edge", sa.Boolean, server_default="false"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("validated", sa.Boolean, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 13. module_relationships
    op.create_table(
        "module_relationships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "source_module_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modules.id"),
            nullable=False,
        ),
        sa.Column(
            "target_module_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("modules.id"),
            nullable=False,
        ),
        sa.Column("connection_strength", sa.Float, nullable=True),
        sa.Column("shared_entity_count", sa.Integer, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
    )

    # 14. challenges
    op.create_table(
        "challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crystallization_jobs.id"),
            nullable=False,
        ),
        sa.Column("challenge_type", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "challenger_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("reasoning", sa.Text, nullable=False),
        sa.Column("evidence", postgresql.JSONB, nullable=True),
        sa.Column("proposed_resolution", postgresql.JSONB, nullable=True),
        sa.Column("status", sa.String(50), server_default="open"),
        sa.Column(
            "resolved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("resolution_reasoning", sa.Text, nullable=True),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
        sa.Column("impact_analysis", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 15. challenge_comments
    op.create_table(
        "challenge_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "challenge_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("challenges.id"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 16. feedback_constraints
    op.create_table(
        "feedback_constraints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("constraint_type", sa.String(50), nullable=False),
        sa.Column("entities", postgresql.JSONB, nullable=True),
        sa.Column("weight", sa.Float, server_default="1.0"),
        sa.Column(
            "source_challenge_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("challenges.id"),
            nullable=True,
        ),
        sa.Column("active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 17. lineage_events
    op.create_table(
        "lineage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("subject_type", sa.String(100), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_type", sa.String(50), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("inputs", postgresql.JSONB, nullable=True),
        sa.Column("outputs", postgresql.JSONB, nullable=True),
        sa.Column("parameters", postgresql.JSONB, nullable=True),
        sa.Column(
            "parent_event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lineage_events.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 18. user_roles
    op.create_table(
        "user_roles",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(50), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            primary_key=True,
            nullable=True,
        ),
        sa.Column(
            "granted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("granted_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 19. data_classifications
    op.create_table(
        "data_classifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column("classification", sa.String(50), nullable=False),
        sa.Column(
            "classified_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("reasoning", sa.Text, nullable=True),
        sa.Column("classified_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 20. reports
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crystallization_jobs.id"),
            nullable=False,
        ),
        sa.Column("report_type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column(
            "generated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("generated_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 21. alert_rules
    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("rule_type", sa.String(100), nullable=False),
        sa.Column("conditions", postgresql.JSONB, nullable=True),
        sa.Column("delivery_method", sa.String(50), nullable=False),
        sa.Column("delivery_config", postgresql.JSONB, nullable=True),
        sa.Column("active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 22. alert_events
    op.create_table(
        "alert_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("alert_rules.id"),
            nullable=False,
        ),
        sa.Column(
            "triggered_by_job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crystallization_jobs.id"),
            nullable=False,
        ),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column("delivered", sa.Boolean, server_default="false"),
        sa.Column("delivered_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 23. api_keys
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("permissions", postgresql.JSONB, nullable=True),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # 24. audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("timestamp", sa.DateTime, server_default=sa.text("now()"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_type", sa.String(50), nullable=True),
        sa.Column("actor_ip", sa.String(45), nullable=True),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column("result", sa.String(50), nullable=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_audit_log_search",
        "audit_log",
        ["timestamp", "actor_id", "action", "resource_type"],
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("api_keys")
    op.drop_table("alert_events")
    op.drop_table("alert_rules")
    op.drop_table("reports")
    op.drop_table("data_classifications")
    op.drop_table("user_roles")
    op.drop_table("lineage_events")
    op.drop_table("feedback_constraints")
    op.drop_table("challenge_comments")
    op.drop_table("challenges")
    op.drop_table("module_relationships")
    op.drop_table("hidden_connections")
    op.drop_table("module_entities")
    op.drop_table("modules")
    op.drop_table("training_metrics")
    op.drop_table("crystallization_jobs")
    op.drop_table("ingestion_logs")
    op.drop_table("relationship_types")
    op.drop_table("entity_types")
    op.drop_table("datasets")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("organizations")
