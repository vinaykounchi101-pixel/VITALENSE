"""002 Auth, Sync Tombstones, Cursors, and Expanded Metrics.

Revision ID: 002_auth_sync_expanded_metrics
Revises: 001_initial_core_schema
Create Date: 2026-11-01

Implements:
- OD-01: Expanded Phase 1 metrics (resting_heart_rate, blood_pressure_systolic,
  blood_pressure_diastolic, blood_oxygen_saturation, blood_glucose)
- OD-04: Immutable manual-entry corrections via superseded_by_id lineage
- OD-07: Configurable retention and deletion foundations
- OD-14: Sync tombstones and per-device cursor tracking
- OD-18: Self-hosted authentication credentials and rotating refresh token families
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002_auth_sync_expanded_metrics"
down_revision: Union[str, None] = "001_initial_core_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Expanded Metric Definitions (OD-01 Option B)
    # -------------------------------------------------------------------------
    metric_definitions_table = sa.table(
        "metric_definitions",
        sa.column("canonical_id", sa.String),
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("data_type", sa.String),
        sa.column("canonical_unit", sa.String),
        sa.column("validation_rules", postgresql.JSONB),
        sa.column("display_rules", postgresql.JSONB),
        sa.column("is_active", sa.Boolean),
    )

    op.bulk_insert(
        metric_definitions_table,
        [
            {
                "canonical_id": "resting_heart_rate",
                "name": "Resting Heart Rate",
                "category": "cardiovascular",
                "data_type": "numeric",
                "canonical_unit": "bpm",
                "validation_rules": {"min": 20, "max": 250},
                "display_rules": {"decimals": 0, "icon": "heart-pulse"},
                "is_active": True,
            },
            {
                "canonical_id": "blood_pressure_systolic",
                "name": "Systolic Blood Pressure",
                "category": "cardiovascular",
                "data_type": "numeric",
                "canonical_unit": "mmHg",
                "validation_rules": {"min": 50, "max": 300, "paired_metric": "blood_pressure_diastolic"},
                "display_rules": {"decimals": 0, "icon": "gauge"},
                "is_active": True,
            },
            {
                "canonical_id": "blood_pressure_diastolic",
                "name": "Diastolic Blood Pressure",
                "category": "cardiovascular",
                "data_type": "numeric",
                "canonical_unit": "mmHg",
                "validation_rules": {"min": 30, "max": 200, "paired_metric": "blood_pressure_systolic"},
                "display_rules": {"decimals": 0, "icon": "gauge"},
                "is_active": True,
            },
            {
                "canonical_id": "blood_oxygen_saturation",
                "name": "Blood Oxygen Saturation (SpO2)",
                "category": "respiratory",
                "data_type": "numeric",
                "canonical_unit": "percentage",
                "validation_rules": {"min": 50, "max": 100},
                "display_rules": {"decimals": 1, "icon": "lungs"},
                "is_active": True,
            },
            {
                "canonical_id": "blood_glucose",
                "name": "Blood Glucose",
                "category": "metabolic",
                "data_type": "numeric",
                "canonical_unit": "mg/dL",
                "validation_rules": {"min": 20, "max": 1000},
                "display_rules": {"decimals": 1, "icon": "drop"},
                "is_active": True,
            },
        ],
    )

    # -------------------------------------------------------------------------
    # 2. Immutable Revisions on health_records (OD-04)
    # -------------------------------------------------------------------------
    op.add_column(
        "health_records",
        sa.Column(
            "superseded_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("health_records.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_health_records_superseded_by_id",
        "health_records",
        ["superseded_by_id"],
    )

    # -------------------------------------------------------------------------
    # 3. auth_credentials Table (OD-18)
    # -------------------------------------------------------------------------
    op.create_table(
        "auth_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_auth_credentials_user_account_id",
        "auth_credentials",
        ["user_account_id"],
        unique=True,
    )

    # -------------------------------------------------------------------------
    # 4. auth_refresh_tokens Table (OD-18)
    # -------------------------------------------------------------------------
    op.create_table(
        "auth_refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(100), nullable=True),
        sa.Column("device_name", sa.String(150), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_consumed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_auth_refresh_tokens_token_hash",
        "auth_refresh_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_auth_refresh_tokens_family_id",
        "auth_refresh_tokens",
        ["family_id"],
    )
    op.create_index(
        "ix_auth_refresh_tokens_user_account_id",
        "auth_refresh_tokens",
        ["user_account_id"],
    )

    # -------------------------------------------------------------------------
    # 5. sync_tombstones Table (OD-14)
    # -------------------------------------------------------------------------
    op.create_table(
        "sync_tombstones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("record_type", sa.String(50), nullable=False, server_default="health_record"),
        sa.Column("target_record_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", sa.String(100), nullable=True),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_sync_tombstones_person_deleted",
        "sync_tombstones",
        ["person_id", "deleted_at"],
    )
    op.create_index(
        "ix_sync_tombstones_target",
        "sync_tombstones",
        ["target_record_id"],
    )

    # -------------------------------------------------------------------------
    # 6. client_sync_cursors Table (OD-14)
    # -------------------------------------------------------------------------
    op.create_table(
        "client_sync_cursors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("device_id", sa.String(100), nullable=False),
        sa.Column("last_sync_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_client_sync_cursors_person_id",
        "client_sync_cursors",
        ["person_id"],
    )
    op.create_unique_constraint(
        "uq_client_sync_cursors_person_device",
        "client_sync_cursors",
        ["person_id", "device_id"],
    )


def downgrade() -> None:
    # 6. client_sync_cursors
    op.drop_constraint("uq_client_sync_cursors_person_device", "client_sync_cursors", type_="unique")
    op.drop_index("ix_client_sync_cursors_person_id", table_name="client_sync_cursors")
    op.drop_table("client_sync_cursors")

    # 5. sync_tombstones
    op.drop_index("ix_sync_tombstones_target", table_name="sync_tombstones")
    op.drop_index("ix_sync_tombstones_person_deleted", table_name="sync_tombstones")
    op.drop_table("sync_tombstones")

    # 4. auth_refresh_tokens
    op.drop_index("ix_auth_refresh_tokens_user_account_id", table_name="auth_refresh_tokens")
    op.drop_index("ix_auth_refresh_tokens_family_id", table_name="auth_refresh_tokens")
    op.drop_index("ix_auth_refresh_tokens_token_hash", table_name="auth_refresh_tokens")
    op.drop_table("auth_refresh_tokens")

    # 3. auth_credentials
    op.drop_index("ix_auth_credentials_user_account_id", table_name="auth_credentials")
    op.drop_table("auth_credentials")

    # 2. superseded_by_id on health_records
    op.drop_index("ix_health_records_superseded_by_id", table_name="health_records")
    op.drop_column("health_records", "superseded_by_id")

    # 1. remove seeded metrics
    op.execute(
        "DELETE FROM metric_definitions WHERE canonical_id IN ("
        "'resting_heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic', "
        "'blood_oxygen_saturation', 'blood_glucose')"
    )

