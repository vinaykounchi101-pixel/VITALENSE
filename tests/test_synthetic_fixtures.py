"""Tests validating synthetic fixtures integrity (no real health data or PII)."""

import json
from pathlib import Path


def test_synthetic_records_structure():
    """Verify synthetic fixture file exists, parses, and contains valid test keys."""
    fixture_path = (
        Path(__file__).resolve().parent.parent
        / "database"
        / "fixtures"
        / "synthetic_records.json"
    )
    assert fixture_path.exists(), "synthetic_records.json fixture must exist"

    with open(fixture_path, encoding="utf-8") as f:
        data = json.load(f)

    assert "user_account" in data
    assert "person" in data
    assert "source_records" in data
    assert "health_records" in data
    assert "audit_event" in data

    # Verify synthetic account and person linkage
    account_id = data["user_account"]["id"]
    assert data["person"]["user_account_id"] == account_id

    # Verify health record links to person
    person_id = data["person"]["id"]
    for record in data["health_records"]:
        assert record["person_id"] == person_id
        assert record["metric_id"] in ("steps", "heart_rate")
        assert "unit" in record
        assert "event_timestamp" in record

    # Verify audit event has result
    assert data["audit_event"]["result"] == "success"
