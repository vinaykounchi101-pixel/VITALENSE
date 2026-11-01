"""VitalSense Canonical Domain Models.

Exposes declarative base and domain entities for database schemas and migrations.
"""

from vitalsense_common.models.account import Person, UserAccount
from vitalsense_common.models.audit import AuditEvent
from vitalsense_common.models.auth import (
    AuthCredential,
    AuthPasswordResetToken,
    AuthRefreshToken,
)
from vitalsense_common.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from vitalsense_common.models.health_record import HealthRecord, SourceRecord
from vitalsense_common.models.metric import MetricDefinition
from vitalsense_common.models.sync import ClientSyncCursor, SyncTombstone

__all__ = [
    "Base",
    "UUIDPrimaryKeyMixin",
    "TimestampMixin",
    "utc_now",
    "UserAccount",
    "Person",
    "MetricDefinition",
    "SourceRecord",
    "HealthRecord",
    "AuditEvent",
    "AuthCredential",
    "AuthRefreshToken",
    "AuthPasswordResetToken",
    "SyncTombstone",
    "ClientSyncCursor",
]
