"""001 Initial Core Schema and Canonical Metric Registry Seed.

Revision ID: 001_initial_core_schema
Revises: None
Create Date: 2026-10-27

Implements DATA-001 through DATA-005, ARCH-004, ARCH-010, FR-METRIC-004,
and SYNC-016.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_core_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. user_accounts: Identity and Account Boundary
    # -------------------------------------------------------------------------
    op.create_table(
        "user_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
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
    op.create_index("ix_user_accounts_email", "user_accounts", ["email"], unique=True)

    # -------------------------------------------------------------------------
    # 2. persons: Person Boundary (ARCH-010, FR-FAM-001)
    # -------------------------------------------------------------------------
    op.create_table(
        "persons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "relationship_type",
            sa.String(50),
            nullable=False,
            server_default="self",
        ),
        sa.Column("display_name", sa.String(100), nullable=True),
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
    op.create_index("ix_persons_user_account_id", "persons", ["user_account_id"])

    # -------------------------------------------------------------------------
    # 3. metric_definitions: Authoritative Metric Registry (FR-METRIC-004)
    # -------------------------------------------------------------------------
    metric_definitions_table = op.create_table(
        "metric_definitions",
        sa.Column("canonical_id", sa.String(100), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("data_type", sa.String(50), nullable=False),
        sa.Column("canonical_unit", sa.String(50), nullable=False),
        sa.Column("validation_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("display_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_metric_definitions_category", "metric_definitions", ["category"])

    # Seed core Phase 1 metrics (DATA-003, FR-METRIC-004)
    op.bulk_insert(
        metric_definitions_table,
        [
            {
                "canonical_id": "steps",
                "name": "Step Count",
                "category": "activity",
                "data_type": "numeric",
                "canonical_unit": "count",
                "validation_rules": {"min": 0, "max": 150000},
                "display_rules": {"decimals": 0, "icon": "footsteps"},
                "is_active": True,
            },
            {
                "canonical_id": "heart_rate",
                "name": "Heart Rate",
                "category": "cardiovascular",
                "data_type": "numeric",
                "canonical_unit": "bpm",
                "validation_rules": {"min": 20, "max": 300},
                "display_rules": {"decimals": 0, "icon": "heart"},
                "is_active": True,
            },
            {
                "canonical_id": "sleep_session",
                "name": "Sleep Session",
                "category": "sleep",
                "data_type": "duration",
                "canonical_unit": "seconds",
                "validation_rules": {"min": 0, "max": 86400},
                "display_rules": {"format": "hours_minutes", "icon": "bed"},
                "is_active": True,
            },
            {
                "canonical_id": "active_energy",
                "name": "Active Energy Burned",
                "category": "activity",
                "data_type": "numeric",
                "canonical_unit": "kcal",
                "validation_rules": {"min": 0, "max": 20000},
                "display_rules": {"decimals": 0, "icon": "flame"},
                "is_active": True,
            },
            {
                "canonical_id": "workout_session",
                "name": "Workout Duration",
                "category": "activity",
                "data_type": "duration",
                "canonical_unit": "seconds",
                "validation_rules": {"min": 0, "max": 86400},
                "display_rules": {"format": "hours_minutes", "icon": "barbell"},
                "is_active": True,
            },
        ],
    )

    # -------------------------------------------------------------------------
    # 4. source_records: Ingestion Receipts & Idempotency (FR-DATA-009, SYNC-016)
    # -------------------------------------------------------------------------
    op.create_table(
        "source_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_name", sa.String(50), nullable=False),
        sa.Column("source_record_id", sa.String(255), nullable=True),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column("source_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "ingestion_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
        sa.UniqueConstraint(
            "person_id",
            "source_name",
            "idempotency_key",
            name="uq_source_records_idempotency",
        ),
    )
    op.create_index("ix_source_records_person_id", "source_records", ["person_id"])
    op.create_index("ix_source_records_source_name", "source_records", ["source_name"])
    op.create_index("ix_source_records_source_record_id", "source_records", ["source_record_id"])
    op.create_index("ix_source_records_idempotency_key", "source_records", ["idempotency_key"])

    # -------------------------------------------------------------------------
    # 5. health_records: Canonical Normalized Records (DATA-001–003, FR-DATA-010)
    # -------------------------------------------------------------------------
    op.create_table(
        "health_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "metric_id",
            sa.String(100),
            sa.ForeignKey("metric_definitions.canonical_id"),
            nullable=False,
        ),
        sa.Column("value", sa.Numeric(14, 4), nullable=True),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_timezone", sa.String(50), nullable=True),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("source_records.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source_name", sa.String(50), nullable=False),
        sa.Column(
            "origin",
            sa.String(50),
            nullable=False,
            server_default="source_imported",
        ),
        sa.Column(
            "correction_state",
            sa.String(50),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "ingestion_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
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
    op.create_index("ix_health_records_person_id", "health_records", ["person_id"])
    op.create_index("ix_health_records_metric_id", "health_records", ["metric_id"])
    op.create_index("ix_health_records_event_timestamp", "health_records", ["event_timestamp"])
    op.create_index("ix_health_records_source_id", "health_records", ["source_id"])
    op.create_index("ix_health_records_source_name", "health_records", ["source_name"])
    op.create_index(
        "ix_health_records_person_metric_time",
        "health_records",
        ["person_id", "metric_id", "event_timestamp"],
    )

    # -------------------------------------------------------------------------
    # 6. audit_events: Immutable Security & Lifecycle Audit Log (SEC-014, PRV-016)
    # -------------------------------------------------------------------------
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_type", sa.String(50), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(100), nullable=True),
        sa.Column("target_id", sa.String(255), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("result", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"])
    op.create_index("ix_audit_events_action", "audit_events", ["action"])
    op.create_index("ix_audit_events_timestamp", "audit_events", ["timestamp"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("health_records")
    op.drop_table("source_records")
    op.drop_table("metric_definitions")
    op.drop_table("persons")
    op.drop_table("user_accounts")
