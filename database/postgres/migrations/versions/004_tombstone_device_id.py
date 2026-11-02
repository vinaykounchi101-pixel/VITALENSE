"""004 Add device_record_id to sync_tombstones.

Revision ID: 004_tombstone_device_id
Revises: 003_auth_password_resets
Create Date: 2026-11-01

Implements OD-14, FR-PRIV-004, and SYNC-014:
- Adds device_record_id to sync_tombstones to track original client record identifiers
  independently of deleted health_records.
- Creates index on (person_id, device_record_id) to enable direct, high-performance
  resurrection checks without joining deleted records.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_tombstone_device_id"
down_revision: Union[str, None] = "003_auth_password_resets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sync_tombstones",
        sa.Column("device_record_id", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_sync_tombstones_device_record_id",
        "sync_tombstones",
        ["person_id", "device_record_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sync_tombstones_device_record_id",
        table_name="sync_tombstones",
    )
    op.drop_column("sync_tombstones", "device_record_id")

