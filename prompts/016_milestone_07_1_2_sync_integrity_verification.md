# VitalSense — Milestone 0.7.1.2
# Sync Integrity & Verification

Act as the senior backend engineer and security reviewer for VitalSense.

Repository:
https://github.com/vinaykounchi101-pixel/VITALENSE

Workspace:
E:\Projects\VITALSENSE

Base branch:
milestone-0.7.1.1-auth-retention-corrections

Expected base commit:
17ccaf8be2284a466b714246e11764053a39abea

New branch:
milestone-0.7.1.2-sync-integrity-verification

IMPORTANT:
This is a focused correction milestone. Do not merge, deploy, force-push,
or modify main/dev. Do not start Milestone 0.8.

1. PREFLIGHT
- Verify repository, working tree and exact base commit.
- Create the new branch from the exact base commit.
- Preserve all existing work.
- Inspect actual code before changing anything.

2. FIX TOMBSTONE RESURRECTION PROTECTION — CRITICAL

Inspect services/sync/service.py.

The device_record_id resurrection check currently joins SyncTombstone
to HealthRecord and SourceRecord. The deletion path removes HealthRecord,
so this join can fail to find an existing tombstone.

Correct this without weakening existing idempotency or deletion rules.

Requirements:
- A deleted record must not be recreated by replaying its original
  device_record_id.
- A deleted record must not be recreated through supersedes_record_id.
- Do not depend on joining a deleted HealthRecord to find its tombstone.
- Use a durable, correctly scoped identity strategy.
- Preserve account/person isolation.
- Ensure deletion wins over pending or replayed uploads.
- Ensure duplicate tombstone submissions remain safe.
- Do not invent new retention rules or silently change OD-14.

Add PostgreSQL integration tests for:
- Delete a record, then replay the same device_record_id.
- Delete a record, then submit a correction referencing its ID.
- Replay after the original HealthRecord has been deleted.
- Another person's record ID must not interfere.
- Duplicate deletion requests must remain idempotent.

3. PROVE FULL-RESYNC DELETION RECONCILIATION

Inspect the full sync lifecycle and API contract.

Requirements:
- A device returning after more than 30 days must receive
  SYNC_CURSOR_EXPIRED.
- Full resync must provide an authoritative active server baseline.
- Previously synced local records absent from that baseline must be
  removable from the client's synced cache.
- Pending offline drafts must not be discarded.
- Pending drafts must be uploaded safely and remain idempotent.
- Deleted records must never be resurrected.
- Account deletion must continue to override pending uploads.
- Clearly distinguish synced records, pending drafts and server records.

Do not claim client cache purging is implemented unless actual client
code exists and proves it.

If clients are not yet implemented:
- Define the precise API response and client reconciliation contract.
- Document the required client algorithm and its invariants.
- Add backend contract tests proving the server behavior.
- Record client-side verification as pending future work.
- Do not mark the entire end-to-end requirement complete.

4. TOMBSTONE RETENTION AND CURSOR EXPIRY

Review the interaction between:
- 30-day tombstone retention,
- 30-day cursor expiry,
- full baseline resynchronization,
- offline drafts,
- deletion propagation.

Ensure no stale client can resurrect deleted records after tombstones
have been pruned.

Do not arbitrarily extend retention or change approved decisions.
If the current data model cannot guarantee this, explain the gap and
propose the smallest safe design correction before implementing it.

5. PASSWORD RESET CONCURRENCY TEST

Keep the current database-backed single-use token implementation.

Add a PostgreSQL integration test that attempts to confirm the same
password-reset token concurrently from two independent database
sessions.

Expected:
- Exactly one confirmation succeeds.
- The other confirmation is rejected.
- Password state is consistent.
- All refresh-token families are revoked.
- No token or password is written to logs.

Do not claim concurrency is verified based only on the existence
of SELECT FOR UPDATE.

6. RETENTION WORKER DEPLOYMENT SAFETY

Review services/workers/retention_worker.py and services/api/main.py.

Requirements:
- Document a recommended single-runner production deployment.
- Explain that enabling the lifespan worker on multiple API processes
  can cause duplicate scheduled execution.
- Keep pruning idempotent and transaction-safe.
- Preserve raw-payload lineage metadata.
- Provide clear instructions for CLI scheduling or a dedicated worker.
- Do not add Redis or paid infrastructure without approval.

7. QUALITY GATES

Run and report:
- Full pytest suite against PostgreSQL.
- New integration tests.
- Migration upgrade/downgrade/re-upgrade if schema changes.
- OpenAPI export and zero-drift check.
- Import checks.
- Lint/type checks if configured.
- Git diff and working-tree verification.

Do not report a check as passed unless it was actually executed.

8. DOCUMENTATION

Update as appropriate:
- PROGRESS.md
- TECHNICAL.md
- README.md
- SRS traceability matrix
- Architecture/decision documentation only if approved decisions change
- Milestone implementation report
- Archived execution prompt under prompts/

Clearly distinguish:
- Implemented and tested
- Implemented but not end-to-end verified
- Deferred to client implementation
- Remaining risks

9. PUBLICATION

Commit and push only to:
milestone-0.7.1.2-sync-integrity-verification

Do not merge into main or dev.
Do not deploy.
Do not force-push.
Do not modify previous milestone branches.

10. FINAL REPORT

Provide:
- Exact base and final commit SHA
- Branch name and publication URL
- Files changed
- Tombstone resurrection fix and tests
- Full-resync contract and verification boundaries
- Concurrent password-reset test result
- Retention deployment guidance
- Full test and migration results
- OpenAPI drift result
- Remaining limitations
- Explicit sign-off recommendation

Keep this milestone strictly scoped to sync integrity, concurrency
verification and retention-worker operational safety.

Do not implement fitness, family management, medical records,
AI assistant, predictive ML or unrelated future-phase functionality.

