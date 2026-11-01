# VitalSense — Milestone 0.7.1
## Authentication, Ingestion & Synchronization Hardening Review

You are continuing development of VitalSense.

Milestone 0.7 has reportedly been implemented on:
`milestone-0.7-core-auth-ingestion-sync`

Your task is NOT to begin Milestone 0.8.

Your task is to perform a rigorous implementation audit of Milestone 0.7 against:
- Approved PRD and SRS
- ADR-001
- System Architecture Blueprint
- Approved OD-01, OD-04, OD-07, OD-14, OD-18 and OD-19 decisions
- Milestone 0.7 implementation report

## 1. Repository inspection

Before changing anything:

1. Inspect the current Git branch and working tree.
2. Verify the Milestone 0.7 branch and its relationship to dev.
3. Read the Milestone 0.7 report and relevant architecture documents.
4. Inspect the actual authentication, ingestion, sync, database, migration, API and CI implementations.
5. Identify existing implementation versus documentation-only claims.

Do not assume the report proves implementation correctness.

Do not overwrite uncommitted user changes.

## 2. Authentication security audit

Verify the following:

- Argon2id uses 64 MiB memory, 3 iterations and parallelism 4.
- Password hashes are never logged or exposed.
- Access tokens expire after 15 minutes.
- Refresh tokens expire after 7 days.
- Refresh tokens are securely generated and stored only as hashes.
- Token rotation is atomic and concurrency-safe.
- Reuse detection revokes the entire affected token family.
- Logout revokes the appropriate session/token family.
- Cross-device session revocation works.
- Failed-login lockout works correctly.
- Rate limiting covers relevant authentication endpoints.
- Password-reset foundations use expiring, single-use tokens.
- Security events are auditable without exposing credentials or tokens.

### Web security

The approved OD-18 decision specifies:

- HttpOnly cookies
- Secure cookies
- SameSite=Strict
- CSRF double-submit protection

The Milestone 0.7 report mentions SameSite=Lax.

Investigate this discrepancy.

Restore SameSite=Strict unless a documented, approved architectural reason requires a change. Do not silently change approved security decisions.

Verify CSRF protection for state-changing cookie-authenticated requests.

Test cookie flags, CSRF validation, logout, refresh and token reuse.

### Native clients

Verify that native clients receive bearer tokens and that the backend does not rely on browser cookie behaviour for native authentication.

Do not implement local token storage in this milestone unless it is already part of the approved scope.

## 3. Ingestion audit

Verify:

- Authentication and record ownership checks.
- Approved metric registry enforcement.
- Metric-specific unit validation.
- Timestamp validation and timezone handling.
- Blood-pressure paired-reading behaviour.
- Idempotency and duplicate prevention.
- Batch-size limits.
- Partial-failure semantics.
- Transaction boundaries and rollback behaviour.
- Immutable manual correction lineage.
- No accidental mutation of historical measurements.
- Source record and raw-payload handling.

Add tests for any missing or weak areas.

## 4. Synchronization audit

Verify that synchronization is a shared domain capability, not a mobile-only implementation.

Both Web and Mobile API namespaces must use the same underlying synchronization service.

All five clients must be supported:
- Android
- iOS
- Windows
- macOS
- Web

Verify:

- Per-device cursors.
- Idempotent uploads.
- Duplicate prevention.
- Conflict handling.
- Tombstone creation and propagation.
- Deleted records cannot be resurrected.
- Account deletion overrides pending uploads.
- Expired cursors return SYNC_CURSOR_EXPIRED.
- Full resync preserves uncommitted local drafts.
- Full resync does not blindly erase local data.
- Concurrent requests do not create duplicate records or lose changes.

Do not implement native encrypted local databases in this milestone; that belongs to a later platform milestone.

## 5. Retention and privacy audit

Verify OD-07:

- Raw ingestion payloads are cleared after 30 days.
- Receipt metadata remains available as approved.
- PHI-redacted logs follow the approved 14-day retention.
- Deletion grace period is 30 days.
- Backups expire after 30 days.
- Deletion propagation includes analytics, predictions, caches and reports as applicable.
- Restoration reconciles against deletion/audit records.

If retention is documented but not operationally enforced, identify and address the missing backend mechanism within the existing architecture.

Do not claim compliance certifications.

## 6. CI and regression tests

Verify the CI workflow actually executes:

- PostgreSQL-backed migration tests.
- Authentication security tests.
- Ingestion integrity tests.
- Synchronization integrity tests.
- OpenAPI drift tests.
- Existing regression tests.

Add meaningful tests for confirmed gaps.

Pay particular attention to concurrency, replay, ownership, CSRF and account-deletion edge cases.

Do not inflate the test count with trivial assertions.

## 7. Documentation

Update only documentation affected by actual code changes.

Keep these aligned:
- Milestone report
- PROGRESS.md
- TECHNICAL.md
- README.md
- SRS traceability matrix
- Open decision register, if applicable

Preserve approved architecture decisions.

## 8. Safety constraints

- Do not modify .env or expose credentials.
- Do not run destructive operations against the user's development database.
- Do not rewrite migration 001.
- Do not create unnecessary new services.
- Do not implement frontend UI.
- Do not implement the Fitness Intelligence module yet.
- Do not start Milestone 0.8.
- Do not commit, push, merge or deploy without explicit authorization.

Work on the existing Milestone 0.7 branch if available. If the branch is unavailable, stop and report the actual repository state rather than creating a speculative replacement.

## 9. Required final report

Create:

docs/milestone_07_1_security_sync_hardening_report.md

The report must contain:

1. Actual branch and commit information.
2. Files inspected.
3. Audit checklist with PASS / FAIL / NOT IMPLEMENTED / NOT VERIFIED.
4. Confirmed security issues.
5. Changes implemented.
6. Tests added and exact results.
7. Migration verification.
8. OpenAPI drift verification.
9. Remaining risks and unresolved decisions.
10. Explicit Milestone 0.7.1 completion status.

Archive the prompt:

prompts/014_milestone_07_1_security_sync_hardening.md

Stop after this milestone and await review.

