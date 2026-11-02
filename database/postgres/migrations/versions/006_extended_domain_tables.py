"""006 Add extended domain tables for insights, medical records, workouts, and imports.

Revision ID: 006_extended_domain
Revises: 005_replay_protection
Create Date: 2026-11-02

Creates tables:
- daily_insights: Stores generated daily briefings and AI intelligence with disclaimers.
- medical_records: Stores metadata for clinical documents, lab tests, and doctor reports.
- workout_details: Stores workout exercises, muscle groups, sets, reps, and volume.
- external_imports: Stores external batch import jobs (Apple Health, Google Takeout, CSV).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "006_extended_domain"
down_revision: Union[str, None] = "005_replay_protection"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. daily_insights
    op.create_table(
        "daily_insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("insight_date", sa.Date(), nullable=False, index=True),
        sa.Column("headline", sa.String(255), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("recovery_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("key_metrics", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("recommendations", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("disclaimer", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False, server_default="deterministic_heuristic"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("person_id", "insight_date", name="uq_daily_insights_person_date"),
    )

    # 2. medical_records
    op.create_table(
        "medical_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("record_type", sa.String(50), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("provider_name", sa.String(255), nullable=True),
        sa.Column("record_date", sa.Date(), nullable=False, index=True),
        sa.Column("document_metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("clinical_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 3. workout_details
    op.create_table(
        "workout_details",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "health_record_id",
            UUID(as_uuid=True),
            sa.ForeignKey("health_records.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("workout_type", sa.String(100), nullable=False, index=True),
        sa.Column("duration_minutes", sa.Numeric(6, 2), nullable=False),
        sa.Column("exercises", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("muscle_groups", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("total_volume_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 4. external_imports
    op.create_table(
        "external_imports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "person_id",
            UUID(as_uuid=True),
            sa.ForeignKey("persons.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("source_platform", sa.String(50), nullable=False, index=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="completed"),
        sa.Column("total_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("external_imports")
    op.drop_table("workout_details")
    op.drop_table("medical_records")
    op.drop_table("daily_insights")

