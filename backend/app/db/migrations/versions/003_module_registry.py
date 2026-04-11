"""Add module_registry table for TCD-JEPA vertical.

Revision ID: 003_module_registry
Revises: 002_auth_upgrade
Create Date: 2026-04-10 00:00:00.000000

Additive only — creates one new table, no changes to existing tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = "003_module_registry"
down_revision: Union[str, None] = "002_auth_upgrade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "module_registry",
        # No server-side default for `id` — both the model and the
        # ModuleRegistryService generate UUIDs in Python (uuid.uuid4),
        # matching the convention from 001_initial / 002_auth_upgrade
        # and avoiding an implicit pgcrypto extension dependency.
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vertical", sa.String(32), nullable=False),
        sa.Column("module_type", sa.String(32), nullable=False),
        sa.Column("module_hash", sa.String(64), nullable=False),
        sa.Column("centroid", JSONB, nullable=False),
        sa.Column("members", JSONB, nullable=False),
        sa.Column("purity", sa.Float, nullable=False),
        sa.Column("quality_score", sa.Float, nullable=False),
        sa.Column("provenance_job_id", sa.String(128), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False
        ),
        sa.UniqueConstraint(
            "provenance_job_id",
            "module_hash",
            name="uq_module_registry_provenance_hash",
        ),
    )
    op.create_index(
        "ix_module_registry_vertical", "module_registry", ["vertical"]
    )
    op.create_index(
        "ix_module_registry_quality", "module_registry", ["quality_score"]
    )


def downgrade() -> None:
    op.drop_index("ix_module_registry_quality", table_name="module_registry")
    op.drop_index("ix_module_registry_vertical", table_name="module_registry")
    op.drop_table("module_registry")
