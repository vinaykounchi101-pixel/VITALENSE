"""005 Add permanent replay protection partial unique index on source_records.

Revision ID: 005_replay_protection
Revises: 004_tombstone_device_id
Create Date: 2026-11-02

Implements permanent device source ID replay protection:
- Enforces uniqueness on (person_id, source_name, source_record_id) when source_record_id IS NOT NULL.
- Guarantees that even after 30-day tombstone pruning, replaying an existing device_record_id
  cannot recreate a deleted record or insert duplicate source records.
- Preserves NULL behavior for manual entries and unkeyed client observations.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_replay_protection"
down_revision: Union[str, None] = "004_tombstone_device_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Defensive check for existing duplicate entries before applying index
    bind = op.get_bind()
    conflict_check = bind.execute(
        sa.text(
            """
            SELECT person_id, source_name, source_record_id, COUNT(*)
            FROM source_records
            WHERE source_record_id IS NOT NULL
            GROUP BY person_id, source_name, source_record_id
            HAVING COUNT(*) > 1;
            """
        )
    ).fetchall()
    if conflict_check:
        raise ValueError(
            f"Cannot create unique index uq_source_records_device_id: found {len(conflict_check)} duplicate groups."
        )

    # 2. Create partial unique index on non-null source_record_id
    op.create_index(
        "uq_source_records_device_id",
        "source_records",
        ["person_id", "source_name", "source_record_id"],
        unique=True,
        postgresql_where=sa.text("source_record_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_source_records_device_id",
        table_name="source_records",
    )

