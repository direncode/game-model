"""Add qr_identity and qr_scan_log tables.

Revision ID: 004_qr_digital_identity
Revises: 003_module_registry
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "004_qr_digital_identity"
down_revision: Union[str, None] = "003_module_registry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "qr_identity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(9), nullable=False, unique=True),
        sa.Column("subject_type", sa.String(50), nullable=False),
        sa.Column("subject_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(10), nullable=False, server_default="public"),
        sa.Column("org_id", UUID(as_uuid=True), nullable=True),
        sa.Column("minted_by", sa.String(255), nullable=False),
        sa.Column("minted_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
    )
    op.create_index("ix_qr_identity_code", "qr_identity", ["code"], unique=True)
    op.create_index("ix_qr_identity_subject", "qr_identity", ["subject_type", "subject_id"])
    op.create_index("ix_qr_identity_org", "qr_identity", ["org_id"])
    op.create_index("ix_qr_identity_tier", "qr_identity", ["tier"])

    op.create_table(
        "qr_scan_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("qr_identity_id", UUID(as_uuid=True), sa.ForeignKey("qr_identity.id"), nullable=False),
        sa.Column("scanned_by", sa.String(255), nullable=True),
        sa.Column("scanned_at", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.Column("access_granted", sa.String(10), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
    )
    op.create_index("ix_qr_scan_log_identity", "qr_scan_log", ["qr_identity_id"])
    op.create_index("ix_qr_scan_log_time", "qr_scan_log", ["scanned_at"])


def downgrade() -> None:
    op.drop_index("ix_qr_scan_log_time", table_name="qr_scan_log")
    op.drop_index("ix_qr_scan_log_identity", table_name="qr_scan_log")
    op.drop_table("qr_scan_log")
    op.drop_index("ix_qr_identity_tier", table_name="qr_identity")
    op.drop_index("ix_qr_identity_org", table_name="qr_identity")
    op.drop_index("ix_qr_identity_subject", table_name="qr_identity")
    op.drop_index("ix_qr_identity_code", table_name="qr_identity")
    op.drop_table("qr_identity")
