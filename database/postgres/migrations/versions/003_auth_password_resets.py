"""003 Database-Backed Single-Use Password Reset Tokens.

Revision ID: 003_auth_password_resets
Revises: 002_auth_sync_expanded_metrics
Create Date: 2026-11-01

Implements SEC-007:
- Database-backed single-use password reset tokens
- SHA-256 token hash storage to prevent credential leakage
- Atomic consumption and revocation tracking to eliminate token replay attacks
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_auth_password_resets"
down_revision: Union[str, None] = "002_auth_sync_expanded_metrics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_password_resets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_consumed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_auth_password_resets_user_account_id",
        "auth_password_resets",
        ["user_account_id"],
    )
    op.create_index(
        "ix_auth_password_resets_token_hash",
        "auth_password_resets",
        ["token_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_password_resets_token_hash", table_name="auth_password_resets")
    op.drop_index("ix_auth_password_resets_user_account_id", table_name="auth_password_resets")
    op.drop_table("auth_password_resets")
