# VitalSense — Milestone 0.7.1.2 Implementation & Verification Report
## Sync Integrity & Verification

**Document Reference:** `docs/milestone_07_1_2_sync_integrity_verification_report.md`  
**Base Commit:** `17ccaf8be2284a466b714246e11764053a39abea`  
**Base Branch:** `milestone-0.7.1.1-auth-retention-corrections`  
**Implementation Branch:** `milestone-0.7.1.2-sync-integrity-verification`  
**Repository:** [github.com/vinaykounchi101-pixel/VITALENSE](https://github.com/vinaykounchi101-pixel/VITALENSE)  
**Execution Date:** 2026-11-01  
**Status:** COMPLETE & VERIFIED (60/60 Tests Passing, Zero OpenAPI Drift, Migration Symmetric)

---

## 1. Executive Summary

Milestone 0.7.1.2 performed a focused, high-precision security and data-integrity correction pass:

1. **Tombstone Resurrection Protection (`OD-14`, `FR-PRIV-004`)**:
   - Resolved the critical flaw where the resurrection check attempted to join `SyncTombstone` with `HealthRecord` and `SourceRecord`, failing after `HealthRecord` was deleted.
   - Authored and applied Alembic migration `004_tombstone_device_id`, adding `device_record_id` and an indexed composite lookup `(person_id, device_record_id)` directly on `sync_tombstones`.
   - Before deleting `HealthRecord`, the server resolves the original `SourceRecord.source_record_id` and records it directly on the `SyncTombstone`.
   - Resurrection prevention now executes direct O(1) indexed lookups without depending on deleted rows.
   - In-batch ordering ensures deletions are processed first, so deletions always win over pending or replayed uploads in the same batch.
   - Verified that replaying a deleted record's `device_record_id` or referencing its ID via `supersedes_record_id` is safely suppressed/rejected, with strict tenant/person isolation and duplicate deletion idempotency.

2. **Full-Resync Deletion Reconciliation Contract (`OD-14`)**:
   - Clarified and formalized the contract for devices returning after >30 days offline (`SYNC_CURSOR_EXPIRED`).
   - Server provides an authoritative active baseline (`server_observations`) excluding all deleted items, with `server_tombstones = []`.
   - Fully documented the client reconciliation algorithm and invariants: synced local records absent from the active server set are purged from the client's local SQLite/Room/IndexedDB cache, while un-synced offline drafts (`pending_upload`) are preserved and uploaded.
   - Added backend contract tests proving server behavior, while explicitly recording client-side local cache execution as pending future client-application implementation in Phase 1.

3. **Database-Backed Password Reset Concurrency (`SEC-007`)**:
   - Implemented real concurrent PostgreSQL integration testing with two simultaneous database sessions confirming the same single-use token via `asyncio.gather`.
   - Verified that pessimistic row-level locking (`SELECT FOR UPDATE`) ensures exactly one confirmation succeeds while the other is rejected with HTTP 400.
   - Proved password state consistency, cross-device refresh token family revocation, and zero credential leakage in logs.

4. **Retention Worker Deployment Safety (`OD-07`, `OD-14`)**:
   - Documented recommended production architecture: run `services/workers/retention_worker.py` as a decoupled single-runner scheduled cron job or Kubernetes CronJob.
   - Documented multi-worker risks: clarified why the FastAPI lifespan worker defaults to `ENABLE_RETENTION_WORKER=false` to prevent duplicate scheduled execution across multiple Uvicorn worker processes or API replicas.
   - Confirmed idempotency and transaction safety of retention queries and preservation of all `source_records` lineage and provenance metadata.

---

## 2. Preflight Verification & Branch Integrity

- **Expected Base Commit:** `17ccaf8be2284a466b714246e11764053a39abea`
- **Verified Working Tree:** Switched from clean base commit to `milestone-0.7.1.2-sync-integrity-verification`.
- **Branch Isolation:** `main` and `dev` remain untouched. No previous milestone branches were modified or force-pushed.
- **Execution Prompt:** Archived in `prompts/016_milestone_07_1_2_sync_integrity_verification.md`.

---

## 3. Tombstone Resurrection Protection — Root Cause & Resolution

### 3.1 The Flaw in Previous Implementation
In Milestone 0.7.1, the ingestion service processed deletions by running:
```sql
DELETE FROM health_records WHERE id = tombstone.target_record_id AND person_id = person_id;
```
When a client later replayed an observation containing `device_record_id`, the resurrection check queried:
```sql
SELECT sync_tombstones.id 
FROM sync_tombstones
JOIN health_records ON health_records.id = sync_tombstones.target_record_id
JOIN source_records ON source_records.id = health_records.source_id
WHERE sync_tombstones.person_id = :person_id 
  AND source_records.source_record_id = :device_record_id;
```
Because the `health_records` row had ALREADY been deleted by the tombstone, this join returned zero rows. As a result, the tombstone was not detected, and the deleted record was re-inserted into `health_records`, violating `OD-14` and `FR-PRIV-004`.

### 3.2 Architectural Resolution
1. **Schema Migration `004_tombstone_device_id`**:
   - Added column `device_record_id VARCHAR(255)` to `sync_tombstones`.
   - Created composite index `ix_sync_tombstones_device_record_id` on `(person_id, device_record_id)`.
2. **Pre-Deletion Device ID Resolution**:
   - When a tombstone arrives, BEFORE deleting `HealthRecord`, the service resolves the associated `SourceRecord.source_record_id`:
     ```python
     hr_source_query = (
         select(SourceRecord.source_record_id)
         .join(HealthRecord, HealthRecord.source_id == SourceRecord.id)
         .where(
             HealthRecord.id == tombstone.target_record_id,
             HealthRecord.person_id == person_id,
         )
     )
     ```
   - Persists `SyncTombstone` with both `target_record_id` and `device_record_id`.
   - Also accepts optional client-supplied `device_record_id` directly in `TombstoneItem`.
3. **Decoupled Resurrection Checks**:
   - **Correction Supersedes Check:**
     ```python
     select(SyncTombstone.id).where(
         SyncTombstone.person_id == person_id,
         SyncTombstone.target_record_id == obs.supersedes_record_id,
     )
     ```
   - **Device Record Replay Check:**
     ```python
     select(SyncTombstone.id).where(
         SyncTombstone.person_id == person_id,
         or_(
             SyncTombstone.device_record_id == obs.device_record_id,
             SyncTombstone.target_record_id == parsed_uuid,  # If device_record_id is a UUID
         ),
     )
     ```
   - Direct indexed query against `sync_tombstones` with zero joins against `health_records`.
4. **Duplicate Tombstone Submissions**:
   - Checks if `SyncTombstone` already exists for `(person_id, target_record_id)` before insertion.
   - If present, idempotently updates missing `device_record_id` and proceeds without error.

---

## 4. Full-Resync Deletion Reconciliation Contract

### 4.1 Server-Side Behavioral Contract
- **Trigger:** Reconnecting client device sends `last_sync_timestamp` older than 30 days (`settings.SYNC_CURSOR_MAX_AGE_DAYS`).
- **Challenge:** Server returns HTTP 409 Conflict with code `SYNC_CURSOR_EXPIRED`.
- **Client Recovery:** Client submits `BatchSyncRequest` with `last_sync_timestamp = None` and includes any local un-synced offline drafts in `observations`.
- **Response Baseline:**
  - `server_observations`: Complete active baseline of all canonical, non-superseded records for the person.
  - `server_tombstones`: Empty list (`[]`).
  - `next_sync_cursor`: Current server UTC timestamp.
  - Any valid offline drafts submitted are ingested and included.

### 4.2 Client-Side Reconciliation Algorithm (Specification)
When client applications are implemented (Phase 1, Milestones 1.x), clients MUST follow this algorithm:
```text
Algorithm FullResyncReconciliation(server_response, local_db):
  1. Begin Local Database Transaction
  2. For each local record R in local_db WHERE R.sync_status == 'synced':
       If R.server_id NOT IN server_response.server_observations.ids:
         DELETE FROM local_db WHERE local_id == R.local_id
  3. For each observation S in server_response.server_observations:
       UPSERT observation S into local_db with sync_status = 'synced'
  4. Preserve all records WHERE sync_status == 'pending_upload' (un-synced drafts)
  5. Update local stored cursor to server_response.next_sync_cursor
  6. Commit Local Database Transaction
```

### 4.3 Verification Boundaries
- **Server Implementation & Backend Contract:** **IMPLEMENTED & VERIFIED** via tests in `tests/test_sync_integrity.py`.
- **Client Cache Purging Implementation:** **SPECIFIED & DEFERRED** to native client implementations (`apps/android/`, `apps/ios/`, `apps/desktop-*`, `apps/web/`).

---

## 5. Tombstone Retention vs. Cursor Expiry Interaction

Under `OD-07` and `OD-14`:
- **Tombstone Retention:** 30 days (`SyncTombstone.deleted_at < cutoff`).
- **Cursor Maximum Age:** 30 days (`SYNC_CURSOR_MAX_AGE_DAYS = 30`).

### Invariant Proof: No Resurrection After Tombstone Pruning
1. If client cursor $\le$ 30 days:
   - Incremental sync is permitted.
   - All tombstones created since the cursor are present in `sync_tombstones` and dispatched to the client in `server_tombstones`.
2. If client cursor $>$ 30 days:
   - Incremental sync is BLOCKED via HTTP 409 `SYNC_CURSOR_EXPIRED`.
   - Client CANNOT receive incremental tombstones because older tombstones have been pruned.
   - Client is FORCED into full baseline resynchronization (`last_sync_timestamp = None`).
   - In full resync, the server returns ONLY the currently active records.
   - Any record deleted $>$30 days ago is absent from the active baseline.
   - The client reconciliation algorithm purges all locally cached synced records absent from the active baseline.
   - If the client attempts to re-upload the deleted record as a draft, `SourceRecord` (which retains its `source_record_id` and `idempotency_key` permanently) recognizes it and suppresses re-insertion.

---

## 6. Password Reset Concurrency Verification

Integration test `test_concurrent_password_reset_confirmation` executed against live PostgreSQL:
- Generated a single-use password reset token.
- Launched two simultaneous `confirm_password_reset` tasks via `asyncio.gather` with independent database sessions.
- **Results:**
  - `confirm_task(pw_attempt_1)`: Succeeded, updated password hash to Argon2id, consumed token, and committed.
  - `confirm_task(pw_attempt_2)`: Blocked by PostgreSQL row-level lock (`with_for_update()`), then evaluated `is_consumed == True`, rejected with HTTP 400 Bad Request (`Password reset token has already been consumed`).
  - Winning password successfully authenticated (`AuthService.authenticate_user`).
  - Losing password and initial password rejected with HTTP 401.
  - Original refresh token family revoked (`is_revoked = True`).
  - Zero passwords or tokens exposed in logs.

---

## 7. Retention Worker Deployment Safety

Documented in `services/workers/retention_worker.py` and `services/api/main.py`:
1. **Decoupled Single-Runner (Recommended Production):**
   - Run as a standalone cron job or Kubernetes CronJob:
     `python -m services.workers.retention_worker --retention-days 30`
   - Schedule once daily at off-peak hours (e.g. 03:00 UTC).
2. **Lifespan Worker Caution:**
   - Setting `ENABLE_RETENTION_WORKER=true` in multi-worker API deployments (e.g. Uvicorn `-w 4` or multi-pod clusters) spawns duplicate background loops across all worker processes.
   - An explicit startup log warning is emitted if `ENABLE_RETENTION_WORKER` is active.
3. **Transaction Safety & Idempotency:**
   - Pruning queries run in dedicated database transactions with automatic rollback on error.
   - Operations are idempotent: setting `raw_payload = NULL` and deleting expired tombstones does not produce race condition data corruption.
   - Lineage metadata in `source_records` is permanently preserved.

---

## 8. Quality Gates & Automated Verification Results

### 8.1 Migration Verification
- Applied `004_tombstone_device_id` -> applied cleanly.
- Downgraded to `003_auth_password_resets` -> dropped column and index cleanly.
- Re-upgraded to `004_tombstone_device_id` -> reapplied cleanly.

### 8.2 OpenAPI Specification Contract Drift
- Exported OpenAPI 3.1.0 specification to `packages/api-contracts/openapi/v1.json`.
- Executed `tests/test_openapi_drift.py` -> **PASSED with 0 contract drift**.

### 8.3 Full Automated Test Suite
Executed full repository pytest suite:
```text
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-8.3.3, pluggy-1.7.0
rootdir: E:\Projects\VITALSENSE
configfile: pyproject.toml
testpaths: tests, services
plugins: anyio-4.15.1, asyncio-0.24.0
collected 60 items

tests/test_api_auth_sync_endpoints.py::test_web_auth_lifecycle_with_cookies PASSED [  1%]
tests/test_api_auth_sync_endpoints.py::test_mobile_auth_and_sync_lifecycle PASSED [  3%]
tests/test_api_endpoints.py::test_liveness_probe_returns_200 PASSED      [  5%]
tests/test_api_endpoints.py::test_readiness_probe_when_database_healthy PASSED [  6%]
tests/test_api_endpoints.py::test_readiness_probe_when_database_unreachable PASSED [  8%]
tests/test_api_endpoints.py::test_web_api_router_status PASSED           [ 10%]
tests/test_api_endpoints.py::test_mobile_api_router_status PASSED        [ 11%]
tests/test_api_endpoints.py::test_correlation_id_passthrough PASSED      [ 13%]
tests/test_api_endpoints.py::test_correlation_id_generated_when_omitted PASSED [ 15%]
tests/test_api_endpoints.py::test_404_standardized_error_envelope PASSED [ 16%]
tests/test_api_endpoints.py::test_error_envelope_structure_conformance PASSED [ 18%]
tests/test_auth_service.py::test_password_validation_and_argon2id_hashing PASSED [ 20%]
tests/test_auth_service.py::test_jwt_token_creation_and_claims_decoding PASSED [ 21%]
tests/test_auth_service.py::test_jwt_token_expiration PASSED             [ 23%]
tests/test_auth_service.py::test_refresh_token_generation_and_hashing PASSED [ 25%]
tests/test_auth_service.py::test_auth_service_registration_and_login_flow PASSED [ 26%]
tests/test_auth_service.py::test_auth_service_brute_force_lockout PASSED [ 28%]
tests/test_auth_service.py::test_auth_service_refresh_token_rotation_and_reuse_revocation PASSED [ 30%]
tests/test_auth_service.py::test_auth_service_session_listing_and_revocation PASSED [ 31%]
tests/test_config.py::test_default_settings PASSED                       [ 33%]
tests/test_config.py::test_invalid_environment_rejected PASSED           [ 35%]
tests/test_config.py::test_production_guards PASSED                      [ 36%]
tests/test_config.py::test_cors_origins_parsing PASSED                   [ 38%]
tests/test_corrections_auth_retention.py::test_password_reset_single_use_lifecycle_and_replay_prevention PASSED [ 40%]
tests/test_corrections_auth_retention.py::test_password_reset_expired_and_invalid_tokens PASSED [ 41%]
tests/test_corrections_auth_retention.py::test_web_auth_endpoints_omit_tokens_from_json_body PASSED [ 43%]
tests/test_corrections_auth_retention.py::test_rate_limiter_rejects_untrusted_forwarded_for_spoofing PASSED [ 45%]
tests/test_corrections_auth_retention.py::test_rate_limiter_accepts_forwarded_for_from_trusted_proxy PASSED [ 46%]
tests/test_corrections_auth_retention.py::test_rate_limiter_bounded_memory_capacity PASSED [ 48%]
tests/test_corrections_auth_retention.py::test_operational_retention_prune_job_runner PASSED [ 50%]
tests/test_corrections_auth_retention.py::test_stale_device_cursor_expiry_and_full_resync_reconciliation PASSED [ 51%]
tests/test_hardening_security_sync.py::test_cookie_security_samesite_strict_and_httponly PASSED [ 53%]
tests/test_hardening_security_sync.py::test_csrf_double_submit_protection PASSED [ 55%]
tests/test_hardening_security_sync.py::test_auth_rate_limiting PASSED    [ 56%]
tests/test_hardening_security_sync.py::test_password_reset_foundations PASSED [ 58%]
tests/test_hardening_security_sync.py::test_batch_size_limit_rejection PASSED [ 60%]
tests/test_hardening_security_sync.py::test_metric_unit_strict_validation PASSED [ 61%]
tests/test_hardening_security_sync.py::test_future_and_inverted_duration_timestamp_validation PASSED [ 63%]
tests/test_hardening_security_sync.py::test_sync_account_deletion_precedence PASSED [ 65%]
tests/test_hardening_security_sync.py::test_resurrection_prevention_against_tombstone PASSED [ 66%]
tests/test_hardening_security_sync.py::test_operational_retention_pruning PASSED [ 68%]
tests/test_ingestion_sync.py::test_paired_blood_pressure_validation PASSED [ 70%]
tests/test_ingestion_sync.py::test_idempotent_deduplication PASSED       [ 71%]
tests/test_ingestion_sync.py::test_immutable_manual_correction_lineage PASSED [ 73%]
tests/test_ingestion_sync.py::test_deletion_tombstone_propagation PASSED [ 75%]
tests/test_ingestion_sync.py::test_cursor_expiration_returns_409 PASSED  [ 76%]
tests/test_logging.py::test_json_formatter_structure PASSED              [ 78%]
tests/test_logging.py::test_privacy_redaction_of_sensitive_keys PASSED   [ 80%]
tests/test_migration_002.py::test_all_10_phase1_metrics_seeded PASSED    [ 81%]
tests/test_migration_002.py::test_migration_002_tables_and_columns_exist PASSED [ 83%]
tests/test_openapi_drift.py::test_openapi_contract_matches_live_app_schema PASSED [ 85%]
tests/test_sync_integrity.py::test_tombstone_prevents_device_record_id_replay_after_health_record_deletion PASSED [ 86%]
tests/test_sync_integrity.py::test_tombstone_blocks_superseding_correction_with_409 PASSED [ 88%]
tests/test_sync_integrity.py::test_person_isolation_on_tombstone_device_record_id PASSED [ 90%]
tests/test_sync_integrity.py::test_duplicate_tombstone_submissions_are_idempotent PASSED [ 91%]
tests/test_sync_integrity.py::test_deletion_wins_over_observation_in_same_sync_batch PASSED [ 93%]
tests/test_sync_integrity.py::test_full_resync_backend_contract_and_draft_preservation PASSED [ 95%]
tests/test_sync_integrity.py::test_account_deletion_overrides_full_resync PASSED [ 96%]
tests/test_sync_integrity.py::test_concurrent_password_reset_confirmation PASSED [ 98%]
tests/test_synthetic_fixtures.py::test_synthetic_records_structure PASSED [100%]

======================= 60 passed, 8 warnings in 25.19s =======================
```
- **Total Tests:** 60
- **Pass Rate:** 100% (60/60)

---

## 9. Requirements Traceability

| Requirement / Decision | Subsystem | Implementation Artifacts | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **OD-14, FR-PRIV-004** (Tombstone Resurrection Fix) | Sync | `004_tombstone_device_id.py`, `SyncTombstone.device_record_id`, `services/sync/service.py` | `test_tombstone_prevents_device_record_id_replay_after_health_record_deletion`, `test_tombstone_blocks_superseding_correction_with_409`, `test_person_isolation_on_tombstone_device_record_id` | **VERIFIED** |
| **OD-14** (Full Resync Contract) | Sync | `services/sync/service.py` | `test_full_resync_backend_contract_and_draft_preservation`, `test_account_deletion_overrides_full_resync` | **VERIFIED (Server-side)** |
| **SEC-007** (Password Reset Concurrency) | Auth | `services/auth/service.py` (`with_for_update()`) | `test_concurrent_password_reset_confirmation` | **VERIFIED** |
| **OD-07, OD-14** (Retention Deployment Safety) | Workers | `services/workers/retention_worker.py`, `services/api/main.py` | Code inspection & operational guidance documentation | **VERIFIED** |

---

## 10. Remaining Limitations & Next Steps

1. **Client Cache Purging:** Backend contracts, baseline delivery, and tombstone propagation are verified on PostgreSQL. End-to-end client cache pruning must be validated once client-side SQLite/Room/IndexedDB sync engines are built in Milestone 1.x.
2. **Distributed Rate Limiting:** In-memory rate limiting is verified and bounded. Horizontal multi-pod deployments will introduce Redis in Phase 2 for cross-node token-bucket synchronization.
3. **Ready for Publication:** All quality gates have been satisfied.

