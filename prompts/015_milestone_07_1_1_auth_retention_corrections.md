# VitalSense — Milestone 0.7.1.1
# Authentication & Retention Corrections

Repository:
https://github.com/vinaykounchi101-pixel/VITALENSE

Workspace:
E:\Projects\VITALSENSE

BASE BRANCH:
milestone-0.7.1-security-data-integrity

NEW BRANCH:
milestone-0.7.1.1-auth-retention-corrections

OBJECTIVE

Perform a focused correction pass based on the latest independent
code review of Milestone 0.7.1.

Do not assume the existing implementation is correct merely because
44 tests passed. Inspect the actual code and reproduce the issues.

1. PRE-FLIGHT

- Inspect Git status and current branch.
- Fetch the latest remote references.
- Confirm the base branch points to commit:
  657842809cd95c17beb1cc917f8d91910570afa2
- Create the new branch from that exact remote branch.
- Preserve all existing work.
- Do not modify main, dev, or previous milestone branches.

2. PASSWORD RESET — SINGLE-USE ENFORCEMENT

Current issue:
Password-reset JWTs contain a jti, but the reset flow does not
persist or consume it. The same token can be replayed before expiry.

Implement a secure, database-backed single-use reset-token lifecycle.

Requirements:
- Persist a hash of the reset token or a securely validated jti.
- Store user ID, expiry, creation time and consumption/revocation state.
- Consume the token atomically during password reset.
- Concurrent confirmation attempts must not both succeed.
- Expired, consumed, revoked and invalid tokens must be rejected.
- Avoid storing raw reset tokens.
- Revoke outstanding reset tokens after a successful password reset.
- Continue revoking all existing refresh-token families.
- Add audit events without logging tokens or passwords.

Test:
- Successful reset.
- Reuse of the same token.
- Expired token.
- Invalid token.
- Two concurrent confirmation attempts.
- Reset token invalidation after successful reset.

3. WEB AUTH RESPONSE TOKEN EXPOSURE

Current issue:
Web register, login and refresh set HttpOnly cookies but also
return access and refresh tokens in JSON response bodies.

Requirements:
- Web browser endpoints must not expose access or refresh tokens
  in JSON response bodies.
- Continue setting the appropriate HttpOnly cookies.
- Preserve the CSRF cookie behaviour.
- Return only safe account/session information.
- Preserve mobile/native JSON bearer-token behaviour.
- Update response schemas and OpenAPI contracts accordingly.
- Ensure web refresh and logout continue working using cookies.

Add tests that inspect actual response JSON and Set-Cookie headers.

4. RATE LIMITING HARDENING

Current issue:
The current limiter is process-local and trusts X-Forwarded-For.

Requirements:
- Document the current deployment limitations.
- Do not trust arbitrary X-Forwarded-For values.
- Only use forwarded client IP information when the request comes
  through explicitly configured trusted proxies.
- Otherwise use the direct client address.
- Prevent unbounded growth of limiter state.
- Make the limiter implementation safe for concurrent requests.
- Evaluate a shared PostgreSQL-backed or Redis-backed approach
  appropriate to the current architecture and budget.

Do not introduce Redis or another paid dependency without documenting
the trade-off and obtaining approval.

If distributed rate limiting is deferred, document it clearly as
a deployment limitation rather than claiming globally enforced
rate limits.

Add tests for spoofed forwarded headers and limiter state cleanup.

5. RAW PAYLOAD RETENTION OPERATIONS

Current issue:
The pruning functions exist, but a function that can be called is
not proof that retention runs automatically.

Requirements:
- Inspect existing worker and application lifecycle architecture.
- Implement a reliable operational execution mechanism for
  prune_expired_raw_payloads.
- Ensure it runs at a documented interval.
- Ensure failures are logged and observable.
- Ensure repeated executions are safe and idempotent.
- Preserve source receipt metadata.
- Never delete normalized canonical health records as part of
  raw-payload pruning.
- Document how the job is enabled, monitored and tested.

Do not use an unreliable in-process background task as the only
production scheduling mechanism when multiple workers may run.

6. TOMBSTONE RETENTION AND FULL RESYNC

Current issue:
Tombstones are purged after 30 days, while clients offline beyond
30 days require a full resynchronization.

Review OD-14 carefully.

Requirements:
- Establish how a client learns about deletions after its cursor expires.
- Ensure full resync cannot leave deleted records in the local cache.
- Preserve unsynchronized local drafts and pending uploads.
- Ensure account deletion overrides pending uploads.
- Ensure no record can be resurrected by a stale device.
- Reconcile tombstone retention with cursor expiry semantics.

Do not simply increase or decrease retention without documenting
the reasoning and updating the relevant decision documentation
if necessary.

Add integration tests simulating a device returning after more
than 30 days, including records deleted while it was offline.

7. TESTING AND VERIFICATION

Run:
- Full pytest suite.
- PostgreSQL-backed integration tests.
- Migration upgrade and downgrade/re-upgrade tests.
- OpenAPI export and drift verification.
- Import checks.
- Configured lint/type checks.

Add regression tests for every correction.

Do not report a test as passing unless it was actually executed.

8. DOCUMENTATION

Update:
- Milestone implementation report.
- PROGRESS.md.
- TECHNICAL.md.
- README.md where relevant.
- OpenAPI contract.
- Traceability matrix if requirements changed.
- Archived Antigravity prompt.

Preserve existing approved architecture decisions.
Do not silently modify PRD/SRS decisions.

9. GIT PUBLICATION

Commit only after verification.

Push to:
milestone-0.7.1.1-auth-retention-corrections

Do not merge.
Do not deploy.
Do not force-push.
Do not modify main, dev or previous milestone branches.

10. FINAL REPORT

Provide:
- New branch URL.
- Commit SHA.
- Files changed.
- Exact test count and result.
- Migration results.
- OpenAPI drift result.
- Password-reset replay test result.
- Web token-exposure test result.
- Rate-limiter limitations.
- Retention scheduling details.
- Expired-cursor/full-resync test result.
- Remaining known gaps.

STRICT SCOPE

This is a focused security and data-integrity correction milestone.

Do not begin fitness features, family health management,
medical records, OAuth implementation or unrelated features.

Do not claim HIPAA or GDPR compliance.

Do not mark the milestone complete if any critical regression
or unresolved data-integrity issue remains.
