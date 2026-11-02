"""External Health Data Import Service.

Parses external files from Apple Health (XML/ZIP), Google Takeout (JSON), and generic CSVs,
translating records into canonical Phase 1 health observations and passing them through
the authoritative SyncService ingestion pipeline.
"""

from __future__ import annotations

import csv
import io
import json
import uuid
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from services.sync.service import SyncService
from vitalsense_common.logging import logger
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.extended import ExternalImport
from vitalsense_common.schemas.sync import BatchSyncRequest, ObservationItem

# Mapping from external platform identifiers to Phase 1 canonical IDs
APPLE_HEALTH_TYPE_MAP = {
    "HKQuantityTypeIdentifierStepCount": ("steps", "count"),
    "HKQuantityTypeIdentifierHeartRate": ("heart_rate", "bpm"),
    "HKQuantityTypeIdentifierRestingHeartRate": ("resting_heart_rate", "bpm"),
    "HKQuantityTypeIdentifierActiveEnergyBurned": ("active_energy", "kcal"),
    "HKQuantityTypeIdentifierOxygenSaturation": ("blood_oxygen_saturation", "percentage"),
    "HKQuantityTypeIdentifierBloodGlucose": ("blood_glucose", "mg/dL"),
    "HKQuantityTypeIdentifierBloodPressureSystolic": ("blood_pressure_systolic", "mmHg"),
    "HKQuantityTypeIdentifierBloodPressureDiastolic": ("blood_pressure_diastolic", "mmHg"),
}


class HealthDataImporter:
    """Service to parse and ingest external health archives and documents."""

    @classmethod
    async def import_file(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        filename: str,
        content_bytes: bytes,
    ) -> ExternalImport:
        """Parse incoming file bytes according to format and ingest through canonical SyncService."""
        lower_name = filename.lower()
        observations: List[ObservationItem] = []
        platform = "generic_file"
        rejected_count = 0
        error_summary = None

        try:
            if lower_name.endswith(".zip"):
                platform = "apple_health_zip"
                observations, rejected_count = cls._parse_apple_health_zip(content_bytes)
            elif lower_name.endswith(".xml"):
                platform = "apple_health_xml"
                observations, rejected_count = cls._parse_apple_health_xml(content_bytes)
            elif lower_name.endswith(".json"):
                platform = "google_takeout_json"
                observations, rejected_count = cls._parse_google_takeout_json(content_bytes)
            elif lower_name.endswith(".csv"):
                platform = "generic_csv"
                observations, rejected_count = cls._parse_csv(content_bytes)
            else:
                raise ValueError(f"Unsupported file format for '{filename}'. Must be .zip, .xml, .json, or .csv.")

            imported_count = 0
            if observations:
                # Ingest through canonical SyncService in chunks of 200
                chunk_size = 200
                for i in range(0, len(observations), chunk_size):
                    chunk = observations[i : i + chunk_size]
                    batch_request = BatchSyncRequest(
                        device_id=f"import-{platform}",
                        observations=chunk,
                    )
                    res = await SyncService.synchronize(session, person_id, batch_request)
                    imported_count += res.processed_count

            import_job = ExternalImport(
                person_id=person_id,
                source_platform=platform,
                filename=filename,
                status="completed",
                total_records=len(observations) + rejected_count,
                imported_records=imported_count,
                rejected_records=rejected_count,
                error_summary=error_summary,
            )
            session.add(import_job)
            await session.flush()
            return import_job

        except Exception as exc:
            logger.error("Import failed", extra={"filename": filename, "error": str(exc)})
            failed_job = ExternalImport(
                person_id=person_id,
                source_platform=platform,
                filename=filename,
                status="failed",
                total_records=0,
                imported_records=0,
                rejected_records=0,
                error_summary=str(exc),
            )
            session.add(failed_job)
            await session.flush()
            raise

    @classmethod
    def _parse_apple_health_xml(cls, xml_bytes: bytes) -> Tuple[List[ObservationItem], int]:
        """Parse Apple Health export.xml format."""
        observations: List[ObservationItem] = []
        rejected = 0
        root = ET.fromstring(xml_bytes)

        for record in root.findall("Record"):
            hk_type = record.get("type")
            if hk_type not in APPLE_HEALTH_TYPE_MAP:
                rejected += 1
                continue

            canonical_metric, canonical_unit = APPLE_HEALTH_TYPE_MAP[hk_type]
            raw_val = record.get("value")
            start_date_str = record.get("startDate")

            if not raw_val or not start_date_str:
                rejected += 1
                continue

            try:
                val = float(raw_val)
                # In Apple Health SpO2 is often 0.98, normalize to percentage (98.0)
                if canonical_metric == "blood_oxygen_saturation" and val <= 1.0:
                    val = val * 100.0

                # Date format: 2026-10-31 08:30:00 -0400
                dt = datetime.strptime(start_date_str[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                observations.append(
                    ObservationItem(
                        metric_name=canonical_metric,
                        value=val,
                        unit=canonical_unit,
                        measured_at=dt,
                        device_record_id=record.get("uuid") or f"apple-{start_date_str}-{val}",
                    )
                )
            except Exception:
                rejected += 1

        return observations, rejected

    @classmethod
    def _parse_apple_health_zip(cls, zip_bytes: bytes) -> Tuple[List[ObservationItem], int]:
        """Extract export.xml from Apple Health zip archive and parse."""
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for name in zf.namelist():
                if name.endswith("export.xml"):
                    with zf.open(name) as f:
                        return cls._parse_apple_health_xml(f.read())
        raise ValueError("No 'export.xml' file found inside uploaded ZIP archive.")

    @classmethod
    def _parse_google_takeout_json(cls, json_bytes: bytes) -> Tuple[List[ObservationItem], int]:
        """Parse Google Takeout / Google Fit JSON records."""
        data = json.loads(json_bytes.decode("utf-8"))
        observations: List[ObservationItem] = []
        rejected = 0

        items = data if isinstance(data, list) else data.get("Data Points", data.get("records", []))
        for item in items:
            metric = item.get("metric_name") or item.get("dataTypeName", "")
            raw_val = item.get("value")
            ts_str = item.get("timestamp") or item.get("startTime")

            if not raw_val or not ts_str:
                rejected += 1
                continue

            # Map common Fit types
            mapped_metric = None
            unit = "count"
            if "step_count" in metric:
                mapped_metric, unit = "steps", "count"
            elif "heart_rate" in metric:
                mapped_metric, unit = "heart_rate", "bpm"
            elif "sleep" in metric:
                mapped_metric, unit = "sleep_session", "hours"

            if not mapped_metric:
                rejected += 1
                continue

            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                observations.append(
                    ObservationItem(
                        metric_name=mapped_metric,
                        value=float(raw_val),
                        unit=unit,
                        measured_at=dt,
                        device_record_id=item.get("id"),
                    )
                )
            except Exception:
                rejected += 1

        return observations, rejected

    @classmethod
    def _parse_csv(cls, csv_bytes: bytes) -> Tuple[List[ObservationItem], int]:
        """Parse generic CSV with columns: metric_name, value, unit, timestamp."""
        reader = csv.DictReader(io.StringIO(csv_bytes.decode("utf-8")))
        observations: List[ObservationItem] = []
        rejected = 0

        for row in reader:
            try:
                metric = row["metric_name"].strip()
                val = float(row["value"].strip())
                unit = row["unit"].strip()
                ts_str = row["timestamp"].strip()
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))

                observations.append(
                    ObservationItem(
                        metric_name=metric,
                        value=val,
                        unit=unit,
                        measured_at=dt,
                        device_record_id=row.get("device_record_id"),
                    )
                )
            except Exception:
                rejected += 1

        return observations, rejected

