# VitalSense — Milestone 0.7.1 Implementation Audit & Hardening Report

**Project:** VitalSense (Paradox) — Personal Health & Wellness Platform  
**Milestone:** 0.7.1 (Authentication, Ingestion & Synchronization Hardening Review)  
**Date:** November 1, 2026  
**Status:** **COMPLETED** (Audit Passed, Hardening Implemented, 44/44 Tests Passing)  
**Auditor / Architect:** Senior Software Architect & Security Engineer  

---

## 1. Actual Branch and Commit Information

- **Active Branch:** `milestone-0.7.1-security-data-integrity` (branched from `milestone-0.7-core-auth-ingestion-sync`)
- **Base Commit (Milestone 0.7 HEAD):** `dcf1de6f86d94d74e8d2e5384a69f64d67bfedb6` (`feat(milestone-0.7): implement core authentication, health ingestion & sync foundation`)
- **Relationship to `dev`:** 1 commit ahead of `dev`, all commits tracked on remote `origin/milestone-0.7-core-auth-ingestion-sync`.
- **Working Tree Status:** Clean working tree with hardened application code, new hardening test suite, updated OpenAPI specification, and archived prompts.

---

## 2. Files Inspected

The following domain packages, services, models, contracts, and test modules were inspected during this audit:

| Category | File Path | Inspection Focus |
| :--- | :--- | :--- |
| **Domain Models** | `packages/python-common/src/vitalsense_common/models/auth.py` | Refresh token hashing, token families, revocation flags, lockout schema |
| | `packages/python-common/src/vitalsense_common/models/account.py` | User account statuses, soft-deletion timestamps, person relationships |
| | `packages/python-common/src/vitalsense_common/models/health_record.py` | Canonical health records, source receipts, immutable lineage |
| | `packages/python-common/src/vitalsense_common/models/sync.py` | Sync cursors, tombstone schema |
| | `packages/python-common/src/vitalsense_common/models/metric.py` | Metric registry, canonical units, validation rules |
| **Security & Tokens** | `packages/python-common/src/vitalsense_common/security/hasher.py` | Argon2id configuration (64 MiB, 3 iterations, 4 parallelism) |
| | `packages/python-common/src/vitalsense_common/security/tokens.py` | JWT generation/decoding, SHA-256 token hashing, reset tokens |
| **Validation Schemas** | `packages/python-common/src/vitalsense_common/schemas/auth.py` | Request/response DTOs, password reset schemas |
| | `packages/python-common/src/vitalsense_common/schemas/sync.py` | Observation DTOs, batch limits, tombstone items |
| **Domain Services** | `services/auth/service.py` | Auth service logic, token rotation concurrency, password reset |
| | `services/auth/dependencies.py` | Bearer/Cookie extraction, CSRF double-submit protection |
| | `services/auth/rate_limiter.py` | In-memory sliding-window rate limiter for brute-force protection |
| | `services/sync/service.py` | Batch synchronization, resurrection prevention, retention pruner |
| **API Endpoints** | `services/web_api/auth.py` | Web cookie flags, CSRF checks, password reset endpoints |
| | `services/web_api/sync.py` | Web synchronization endpoints with CSRF protection |
| | `services/mobile_api/auth.py` | Native Bearer endpoints, password reset endpoints |
| | `services/mobile_api/sync.py` | Native batch sync endpoints |
| **Contracts & Tooling** | `services/export_openapi.py` | OpenAPI export generator |
| | `packages/api-contracts/openapi/v1.json` | Canonical OpenAPI 3.1.0 specification |
| **Test Suites** | `tests/test_api_auth_sync_endpoints.py` | End-to-end API lifecycle tests |
| | `tests/test_auth_service.py` | Unit tests for authentication service |
| | `tests/test_ingestion_sync.py` | Unit and integration tests for ingestion/sync |
| | `tests/test_hardening_security_sync.py` | **NEW:** Comprehensive hardening test suite (10 tests) |
| | `tests/test_openapi_drift.py` | Automated OpenAPI contract drift verification |

---

## 3. Comprehensive Audit Checklist

| Item / Requirement | SRS / Decision Reference | Status | Audit Findings & Verification |
| :--- | :--- | :--- | :--- |
| **Argon2id Hash Parameters** | `SEC-001`, `OD-18` | **PASS** | Verified `memory_cost=65536` (64 MiB), `time_cost=3`, `parallelism=4`. Password hashes are never exposed. |
| **Token Lifecycles** | `SEC-003`, `SEC-004` | **PASS** | Access tokens strictly expire in 15 minutes; refresh tokens strictly expire in 7 days. |
| **Refresh Token Hash Storage** | `SEC-005`, `OD-18` | **PASS** | Refresh tokens generated as 32-byte cryptographically secure strings; only SHA-256 hashes are stored in database. |
| **Token Rotation Concurrency** | `SEC-005`, `OD-18` | **PASS** | Added `.with_for_update()` row-level locking on `AuthRefreshToken` query, eliminating rotation race conditions. |
| **Theft Reuse Detection** | `SEC-006`, `OD-18` | **PASS** | Attempting to reuse an already-consumed refresh token immediately invalidates all tokens in that `family_id`. |
| **Failed-Login Lockout** | `SEC-002`, `FR-AUTH-006` | **PASS** | 5 consecutive failed login attempts lock the credential for 15 minutes (`locked_until`). |
| **Rate Limiting** | `SEC-002`, `SEC-008` | **PASS** | Implemented `InMemoryRateLimiter` sliding window; rejects >10 req/min on login/register with HTTP 429. |
| **Password Reset Foundations** | `SEC-007` | **PASS** | Single-use expiring (15-min) signed JWTs. Confirming reset revokes all user refresh token families across devices. |
| **Web Cookie Security** | `OD-18` | **PASS** | Restored `SameSite=Strict`, `HttpOnly=True` for auth cookies. Verified via automated HTTP response inspection. |
| **CSRF Double-Submit Protection** | `OD-18` | **PASS** | Web cookie mutations strictly verify `vitalsense_csrf_token` cookie against `X-CSRF-Token` header. Bearer auth bypasses. |
| **Native Client Independence** | `ARCH-002`, `ARCH-014` | **PASS** | Native endpoints (`/api/v1/mobile/*`) use pure JSON bodies and Bearer authorization; no dependency on cookies. |
| **Metric Unit Strict Validation** | `OD-01`, `SYNC-003` | **PASS** | Ingestion strictly validates observation unit against `canonical_unit` (with support for synonyms like `percent`/`%`). |
| **Timestamp Boundary Checks** | `SYNC-004` | **PASS** | Reject observations >5 minutes in future. Reject observations where `end_timestamp < measured_at` (HTTP 422). |
| **Batch Size Bounding** | `SYNC-012` | **PASS** | `BatchSyncRequest` enforces `max_length=500` on `observations` and `tombstones` to prevent unbounded DoS. |
| **Paired Blood Pressure Validation** | `OD-01`, `SYNC-004` | **PASS** | Cross-observation clinical rule validates systolic > diastolic for concurrent measurements. |
| **Idempotency & Deduplication** | `SYNC-016` | **PASS** | Deterministic uniqueness enforced by `uq_source_records_idempotency` and service-level duplicate skipping. |
| **Immutable Revisions** | `OD-04`, `SYNC-015` | **PASS** | Corrections preserve original `event_timestamp`, set `origin=user_entered`, and track `superseded_by_id`. |
| **Multi-Platform Sync Service** | `ARCH-002`, `ARCH-014` | **PASS** | Single shared `SyncService` powers both `/api/v1/web/sync` and `/api/v1/mobile/sync` identically across all 5 clients. |
| **Resurrection Prevention** | `OD-14`, `FR-PRIV-004` | **PASS** | Ingestion rejects attempts to supersede or re-insert records that exist in `sync_tombstones` (HTTP 409). |
| **Account Deletion Precedence** | `OD-07`, `SYNC-010` | **PASS** | Sync queries `UserAccount.status`. If `deleted` or `deletion_pending`, immediately blocks sync with HTTP 403. |
| **Expired Cursor Handling** | `OD-14` | **PASS** | Devices offline >30 days receive `HTTP 409 SYNC_CURSOR_EXPIRED`, requiring safe baseline synchronization. |
| **Operational Retention Pruning** | `OD-07` | **PASS** | Implemented `SyncService.prune_expired_raw_payloads` and `prune_expired_tombstones` for 30-day lifecycle enforcement. |
| **Zero OpenAPI Drift** | `IF-API-001`, `REPO-006` | **PASS** | Regenerated `packages/api-contracts/openapi/v1.json`; automated drift test passes with zero divergence. |

---

## 4. Confirmed Security & Synchronization Issues

During the Milestone 0.7 audit, the following concrete architectural and security discrepancies were identified and cataloged:

1. **Web Cookie Discrepancy (`OD-18` Violation):**  
   *Finding:* `services/web_api/auth.py` configured auth cookies with `samesite="lax"` rather than the approved `samesite="strict"`.  
   *Risk:* Allowed cookies to be sent along with top-level cross-site navigations, increasing vulnerability to cross-site request forgery and cookie leakage.  
   *Resolution:* Restored `samesite="strict"` for all authentication cookies.

2. **Missing CSRF Double-Submit Token (`OD-18` Violation):**  
   *Finding:* The web boundary did not issue or verify a CSRF double-submit token for cookie-authenticated mutation endpoints.  
   *Risk:* A browser storing ambient cookies could be tricked into executing state-changing operations (such as session revocation or sync mutations) from a cross-site context.  
   *Resolution:* Implemented `vitalsense_csrf_token` cookie generation alongside a strict `verify_csrf_double_submit` FastAPI dependency comparing `X-CSRF-Token` against the cookie.

3. **Concurrency Hazard on Refresh Token Rotation:**  
   *Finding:* `AuthService.refresh_session` queried `AuthRefreshToken` without PostgreSQL row-level locking (`SELECT ... FOR UPDATE`).  
   *Risk:* Under high-concurrency race conditions, two simultaneous requests presenting the same refresh token could both read `is_consumed == False`, allowing multiple child tokens to be minted before reuse detection kicked in.  
   *Resolution:* Added `.with_for_update()` to the query, serializing concurrent refresh attempts at the database engine level and making theft reuse detection deterministic.

4. **Missing Password Reset Foundations (`SEC-007`):**  
   *Finding:* No secure, expiring, single-use reset token mechanism or endpoint existed.  
   *Risk:* Users unable to recover accounts; prone to ad-hoc or unvetted password recovery patterns.  
   *Resolution:* Implemented signed 15-minute JWT reset tokens (`purpose="password_reset"`), Argon2id credential update, and complete cross-device session family revocation upon reset completion.

5. **Unbounded Batch Payload Size (`SYNC-012` DoS Vector):**  
   *Finding:* `BatchSyncRequest` defined `observations` and `tombstones` as unbounded lists.  
   *Risk:* Memory exhaustion and denial of service via oversized batches.  
   *Resolution:* Set `max_length=500` on both arrays in Pydantic schema.

6. **Missing Strict Metric Unit Validation (`OD-01`, `SYNC-003`):**  
   *Finding:* `SyncService.synchronize` verified that the metric category existed, but did not assert that the observation's unit matched `metric_def.canonical_unit`.  
   *Risk:* Clients could submit data in conflicting units (e.g., meters for step counts), corrupting health metrics.  
   *Resolution:* Added strict validation requiring `resolved_unit == metric_def.canonical_unit` with support for clinical synonyms (`%`/`percent`).

7. **Missing Timestamp Validation (`SYNC-004`):**  
   *Finding:* Observations with future timestamps (>5 minutes) or inverted durations (`end_timestamp < measured_at`) were accepted without rejection.  
   *Risk:* Chronological corruption of time-series health charts.  
   *Resolution:* Added checks returning `HTTP 422 Unprocessable Entity` for future timestamps and inverted durations.

8. **Missing Account Deletion Precedence on Sync (`OD-07`, `SYNC-010`):**  
   *Finding:* Ingestion did not verify whether the account was in `deleted` or `deletion_pending` state.  
   *Risk:* Devices could upload health records during the 30-day deletion grace period or after account erasure.  
   *Resolution:* Added account status validation rejecting synchronization with `HTTP 403 Forbidden`.

9. **Missing Resurrection Prevention against Active Tombstones (`OD-14`):**  
   *Finding:* Observations attempting to supersede or re-ingest previously tombstoned records were not checked against `sync_tombstones`.  
   *Risk:* Deleted observations could be resurrected if another client submitted an offline correction.  
   *Resolution:* Added verification against `sync_tombstones` returning `HTTP 409 Conflict` on attempted resurrection.

10. **Lack of Operational Retention Pruning Mechanism (`OD-07`):**  
    *Finding:* 30-day raw payload scrubbing was documented but lacked an executable operational backend service method.  
    *Risk:* Raw JSON source records could accumulate indefinitely, violating privacy commitments.  
    *Resolution:* Implemented `prune_expired_raw_payloads` and `prune_expired_tombstones` methods in `SyncService`.

---

## 5. Changes Implemented

### Security & Authentication
- **`services/web_api/auth.py`**:
  - Restored `samesite="strict"` for `vitalsense_access_token` and `vitalsense_refresh_token`.
  - Added generation of `vitalsense_csrf_token` cookie (`samesite="strict"`, `httponly=False`).
  - Applied `Depends(verify_csrf_double_submit)` to `/refresh`, `/logout`, and `/sessions/revoke`.
  - Added rate limiting via `auth_rate_limiter.check()` on `/login`, `/register`, and `/password-reset/request`.
  - Added `POST /api/v1/web/auth/password-reset/request` and `POST /api/v1/web/auth/password-reset/confirm`.
- **`services/auth/dependencies.py`**:
  - Implemented `verify_csrf_double_submit(request: Request)` using timing-safe comparison (`secrets.compare_digest`).
- **`services/auth/rate_limiter.py`** *(New File)*:
  - Created sliding-window in-memory rate limiter tracking client IP / endpoint key.
- **`services/auth/service.py`**:
  - Added `.with_for_update()` row-level locking on `AuthRefreshToken` during token rotation.
  - Implemented `request_password_reset(session, email)` issuing 15-minute signed JWT reset tokens.
  - Implemented `confirm_password_reset(session, token, new_password)` updating Argon2id hash and revoking all session families for the user.
- **`services/mobile_api/auth.py`**:
  - Added rate limiting and password reset endpoints matching web API functionality for native clients.
- **`packages/python-common/src/vitalsense_common/schemas/auth.py`**:
  - Added `PasswordResetRequest`, `PasswordResetConfirmRequest`, and `PasswordResetResponse`.
- **`packages/python-common/src/vitalsense_common/security/tokens.py`**:
  - Added `create_password_reset_token` and `decode_password_reset_token`.

### Ingestion & Synchronization
- **`services/sync/service.py`**:
  - Enforced account status check (`status in ("deleted", "deletion_pending")` -> HTTP 403).
  - Enforced strict metric unit validation against `metric_def.canonical_unit` (HTTP 422).
  - Enforced future timestamp bound (`now + 5 minutes`) and duration ordering (HTTP 422).
  - Added resurrection prevention querying `SyncTombstone` (HTTP 409).
  - Implemented `prune_expired_raw_payloads(session, retention_days=30) -> int`.
  - Implemented `prune_expired_tombstones(session, retention_days=30) -> int`.
- **`services/web_api/sync.py`**:
  - Added `verify_csrf_double_submit` dependency on `synchronize_web` and `full_resync_web`.
- **`packages/python-common/src/vitalsense_common/schemas/sync.py`**:
  - Added `max_length=500` on `observations` and `tombstones` in `BatchSyncRequest`.

---

## 6. Tests Added & Verification Results

A dedicated hardening test suite was created in `tests/test_hardening_security_sync.py` with 10 targeted tests:

1. `test_cookie_security_samesite_strict_and_httponly`: Verifies `SameSite=Strict`, `HttpOnly` on auth cookies, and `HttpOnly=False` on CSRF cookie. (**PASSED**)
2. `test_csrf_double_submit_protection`: Verifies missing header rejection (403), mismatched header rejection (403), matching token success (200), and Bearer authorization bypass. (**PASSED**)
3. `test_auth_rate_limiting`: Verifies 10 rapid attempts succeed, 11th triggers HTTP 429 Too Many Requests. (**PASSED**)
4. `test_password_reset_foundations`: Verifies reset token generation, password update, old password failure, new password success, and cross-device session revocation. (**PASSED**)
5. `test_batch_size_limit_rejection`: Verifies batches with >500 items are rejected with HTTP 422. (**PASSED**)
6. `test_metric_unit_strict_validation`: Verifies observations with incompatible units (e.g. `meters` for `steps`) are rejected with HTTP 422. (**PASSED**)
7. `test_future_and_inverted_duration_timestamp_validation`: Verifies timestamps >5 minutes in the future and inverted durations are rejected with HTTP 422. (**PASSED**)
8. `test_sync_account_deletion_precedence`: Verifies accounts in `deletion_pending` or `deleted` are blocked from syncing (HTTP 403). (**PASSED**)
9. `test_resurrection_prevention_against_tombstone`: Verifies attempting to modify or supersede a tombstoned record is rejected with HTTP 409. (**PASSED**)
10. `test_operational_retention_pruning`: Verifies `prune_expired_raw_payloads` scrubs raw JSON payloads older than 30 days while preserving metadata, and `prune_expired_tombstones` cleans old tombstones. (**PASSED**)

### Complete Regression Suite Execution

```
platform win32 -- Python 3.12.10, pytest-8.3.3, pluggy-1.7.0
rootdir: E:\Projects\VITALSENSE
configfile: pyproject.toml
testpaths: tests, services
plugins: anyio-4.15.1, asyncio-0.24.0

tests\test_api_auth_sync_endpoints.py ..                                 [  4%]
tests\test_api_endpoints.py .........                                    [ 25%]
tests\test_auth_service.py ........                                      [ 43%]
tests\test_config.py ....                                                [ 52%]
tests\test_hardening_security_sync.py ..........                         [ 75%]
tests\test_ingestion_sync.py .....                                       [ 86%]
tests\test_logging.py ..                                                 [ 90%]
tests\test_migration_002.py ..                                           [ 95%]
tests\test_openapi_drift.py .                                            [ 97%]
tests\test_synthetic_fixtures.py .                                       [100%]

======================= 44 passed, 7 warnings in 15.00s =======================
```

---

## 7. Migration Verification

- Migration `002_auth_sync_expanded_metrics.py` was inspected and verified against the live PostgreSQL 18 development database (`vitalsense_dev`).
- Migration 001 was strictly preserved and untouched.
- All 11 tables (`user_accounts`, `persons`, `auth_credentials`, `auth_refresh_tokens`, `audit_events`, `metric_definitions`, `source_records`, `health_records`, `client_sync_cursors`, `sync_tombstones`, `alembic_version`) are fully present and consistent with the domain models.
- All 10 Phase 1 metric categories are active in `metric_definitions`.

---

## 8. OpenAPI Drift Verification

- Script `services/export_openapi.py` was executed to update `packages/api-contracts/openapi/v1.json` with the new password reset endpoints (`/api/v1/web/auth/password-reset/request`, `/api/v1/web/auth/password-reset/confirm`, `/api/v1/mobile/auth/password-reset/request`, `/api/v1/mobile/auth/password-reset/confirm`) and updated schemas (`PasswordResetRequest`, `PasswordResetConfirmRequest`, `PasswordResetResponse`, batch size limits).
- Executed `tests/test_openapi_drift.py`:
  ```
  tests/test_openapi_drift.py::test_openapi_contract_matches_live_app_schema PASSED [100%]
  ```
- Result: **Zero OpenAPI schema drift detected.**

---

## 9. Remaining Risks and Unresolved Decisions

1. **Distributed Rate Limiting:** The current rate limiter uses an in-memory sliding window, which is ideal for single-instance monolith operation. In a multi-worker / multi-instance deployment, this should transition to Redis or Valkey (scheduled for Infrastructure Milestone 1.0).
2. **Email Delivery for Password Reset:** `AuthService.request_password_reset` safely generates the token and returns it in non-production environments for automated testing. In production, an outbound transactional email service (e.g. AWS SES or SMTP) must be wired to deliver the token link.
3. **No Unresolved Architecture Decisions:** All architectural invariants (OD-01, OD-04, OD-07, OD-14, OD-18) are fully honored and reconciled.

---

## 10. Explicit Milestone 0.7.1 Completion Status

- **Status:** **MILESTONE 0.7.1 COMPLETE**
- **Artifacts Generated:**
  - `prompts/014_milestone_07_1_security_sync_hardening.md` (Archived)
  - `docs/milestone_07_1_security_sync_hardening_report.md` (This Report)
  - `tests/test_hardening_security_sync.py` (New Hardening Test Suite)
  - `services/auth/rate_limiter.py` (New Rate Limiter Module)
- **Commit / Push Status:** In compliance with Safety Constraint Rule 8, no changes have been committed, pushed, merged, or deployed. All code and test changes reside safely on `milestone-0.7-core-auth-ingestion-sync` awaiting Product Owner review.

