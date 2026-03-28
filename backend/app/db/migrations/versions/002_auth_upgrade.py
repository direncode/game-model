"""Add server-side session tracking, email verification, and password reset fields.

Revision ID: 002_auth_upgrade
Revises: 001_initial
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "002_auth_upgrade"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── User table: add email verification + password reset ───
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("email_verification_token", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("password_reset_token", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires", sa.DateTime(), nullable=True))

    # ─── Sessions table: activate with new fields ───
    op.add_column("sessions", sa.Column("device_name", sa.String(255), nullable=True))
    op.add_column("sessions", sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("sessions", sa.Column("last_active_at", sa.DateTime(), nullable=True))

    # Add index on token_hash for fast lookup during refresh
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"])
    # Add index for querying active sessions by user
    op.create_index("ix_sessions_user_active", "sessions", ["user_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_sessions_user_active", table_name="sessions")
    op.drop_index("ix_sessions_token_hash", table_name="sessions")
    op.drop_column("sessions", "last_active_at")
    op.drop_column("sessions", "is_active")
    op.drop_column("sessions", "device_name")
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "email_verification_token")
    op.drop_column("users", "email_verified")
