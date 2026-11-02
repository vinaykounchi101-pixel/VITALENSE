# VitalSense — Milestone 0.7: Core Authentication, Data Ingestion & Offline Synchronization Foundation

## 1. ROLE AND AUTHORIZATION

Act as the Senior Software Architect, Backend Engineer, Database Engineer, Security Engineer, and QA Engineer responsible for implementing VitalSense.

The Product Owner has authorized implementation of Milestone 0.7, following the approved architectural decisions consolidated in Milestone 0.6.

Repository: https://github.com/vinaykounchi101-pixel/VITALENSE
Workspace: E:\Projects\VITALSENSE

First inspect the actual repository state. Do not assume that previous reports accurately represent the current branch, files, database, or environment.

This is an implementation milestone. You are authorized to modify application code, database migrations, tests, API contracts, and CI configuration within the scope below.

Do not implement unrelated features or silently change approved architecture.

## 2. PRIMARY OBJECTIVE

Implement a production-conscious foundation for:

1. Self-hosted authentication and session management.
2. Expanded health metric definitions.
3. Controlled health-data ingestion.
4. Cross-platform synchronization.
5. Offline-first data integrity and deletion propagation.
6. Automated verification and CI.

All five platforms must be supported architecturally:
- Android
- iOS
- Windows
- macOS
- Web

Do not interpret the mobile sync endpoint as a mobile-only synchronization architecture.

## 3. MANDATORY PRE-IMPLEMENTATION INSPECTION

Inspect:

- README.md
- PROGRESS.md
- TECHNICAL.md
- docs/VitalSense_PRD_v1.1.md
- docs/VitalSense_SRS_v1.1.1_Merged.md
- docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv
- docs/VitalSense_SRS_v1.1.1_Open_Decision_Register.md
- docs/architecture/decision_workshop.md
- Consolidated ADR-001
- System Architecture Blueprint
- Current database migrations
- Existing Python common package
- Existing API routers and OpenAPI contract
- Existing test suite and CI configuration

Verify current branch, HEAD, working-tree status, database connectivity, migration state, Python version, dependencies, and existing tests.

Use the actual repository paths if they differ from those listed above.

Before modifying anything, produce a concise implementation plan identifying dependencies, risks, affected files, and migration implications. Then proceed without waiting for another approval, provided no critical contradiction or destructive risk is discovered.

## 4. ARCHITECTURAL CONSTRAINTS

Follow ADR-001.

- Co-deployed modular monolith initially.
- Strict logical Web API and Mobile API routing boundaries.
- Shared identity and canonical health records.
- PostgreSQL is the canonical server data source.
- Shared domain and synchronization services.
- Independently runnable background workers.
- Stateless backend design where practical.
- Support multiple concurrent users and devices.
- No direct database access from client applications.
- No direct n8n PostgreSQL access.
- Do not introduce independently deployed microservices in this milestone.
- Preserve clear module boundaries for future extraction.

All clients synchronize through authenticated backend services.

## 5. WORKSTREAM 1 — DATABASE MIGRATION 002

Create the next Alembic migration using a clear, descriptive filename.

Before implementation, inspect the existing schema carefully and avoid duplicate columns, tables, or indexes.

Implement:

### Expanded metric definitions

The Phase 1 metric set must contain exactly these ten approved metrics:

1. steps
2. heart_rate
3. sleep_session
4. active_energy
5. workout_session
6. resting_heart_rate
7. blood_pressure_systolic
8. blood_pressure_diastolic
9. blood_oxygen_saturation
10. blood_glucose

Define appropriate units, metadata, validation expectations, and source tracking.

Blood pressure systolic and diastolic observations must support paired measurement handling.

Do not fabricate zero measurements or placeholder health records.

Weight and body measurements remain outside this approved Phase 1 set.

### Immutable record corrections

Implement:
- superseded_by_id
- correction_state where appropriate
- origin = user_entered for controlled manual records
- Proper foreign-key relationships and indexes.

Corrections must preserve the original measured_at timestamp and create a new revision rather than silently modifying measurement history.

### Authentication tables

Create the necessary structures for:
- auth_credentials
- auth_refresh_tokens
- Session/device tracking, where required by the design.

Refresh tokens must be stored as secure hashes, never plaintext.

### Synchronization tombstones

Create sync_tombstones with:
- Record identity
- Relevant entity or record type
- Deletion timestamp
- Required ownership/device or cursor metadata
- Indexes supporting efficient synchronization

Implement per-device cursor support using the approved synchronization architecture.

Preserve auditability.

### Migration quality

- Use explicit constraints and indexes.
- Avoid destructive migration behavior.
- Implement a meaningful downgrade where safe.
- Never silently discard existing health records.
- Verify upgrade and downgrade behavior against a disposable test database.
- Verify that existing migration 001 remains intact.

Do not rewrite migration 001 to accommodate migration 002.

## 6. WORKSTREAM 2 — SHARED DOMAIN MODELS AND SCHEMAS

Implement reusable domain models, validation schemas, and service abstractions within the existing repository structure.

Inspect packages/python-common and reuse existing conventions.

Implement:

- Authentication models
- User and device/session models
- Health-record ingestion schemas
- Metric-specific validation
- Immutable correction schemas
- Sync request and response schemas
- Cursor representations
- Tombstone representations
- Structured API error responses

Use Pydantic consistently with the existing project version.

Implement Argon2id password hashing with the approved parameters:

- Memory: 64 MB
- Iterations: 3
- Parallelism: 4

Never store plaintext passwords, raw refresh tokens, or unnecessary sensitive information in logs.

Keep domain validation independent of HTTP routing.

## 7. WORKSTREAM 3 — AUTHENTICATION AND SESSION MANAGEMENT

Implement self-hosted authentication.

### Required capabilities

- User registration
- Login
- Password verification
- Access-token issuance
- Refresh-token rotation
- Logout
- Session revocation
- Device/session tracking
- Authentication audit events
- Password-reset foundations
- Rate limiting and brute-force protection

### Token policy

Access token:
- 15-minute lifetime.

Refresh token:
- 7-day lifetime.
- Rotation on successful refresh.
- Store only a cryptographic hash in PostgreSQL.
- Track token family and consumption/revocation state.

Refresh-token reuse detection:
- Detect reuse of an already consumed token.
- Revoke the entire associated token family.
- Require reauthentication.

### Client-specific security

Web:
- HttpOnly cookies.
- Secure cookies.
- SameSite=Strict.
- CSRF double-submit protection.
- Appropriate XSS protections.

Native clients:
- Secure platform-appropriate token storage.
- Never store authentication secrets in ordinary local storage.

Apple and Google OAuth2 PKCE are planned integrations, not mandatory implementations in this milestone.

### API boundaries

Implement authentication routes under the existing logical namespaces:

/api/v1/web/auth
/api/v1/mobile/auth

Use shared authentication services underneath both routers.

Do not duplicate authentication business logic.

## 8. WORKSTREAM 4 — HEALTH DATA INGESTION AND CROSS-PLATFORM SYNC

This is a particularly important workstream.

Design synchronization as a shared backend capability usable by all five platforms.

The API may expose client-specific routes, but the underlying synchronization service must be shared.

### Ingestion

Implement controlled batch ingestion with:

- Authenticated ownership validation.
- Metric-definition validation.
- Unit validation.
- Timestamp validation.
- Source tracking.
- Batch-size limits.
- Idempotency keys.
- Duplicate prevention.
- Partial failure reporting.
- Transaction-safe writes.
- Appropriate audit events.

Support the approved ten metrics only.

Do not implement unrestricted arbitrary metric ingestion.

### Synchronization API

Implement the proposed mobile route:

/api/v1/mobile/sync

Also establish the appropriate Web synchronization route under:

/api/v1/web/

Both must call the same synchronization domain service.

Ensure the underlying contract can support Android, iOS, Windows, macOS, and Web.

### Offline-first synchronization

Each device/client maintains its own local database and synchronization state.

Expected behavior:

1. Offline changes are stored locally.
2. Pending changes are submitted when connectivity returns.
3. Server validates ownership and payloads.
4. Server processes requests idempotently.
5. Server returns accepted records, conflicts, and updated cursor information.
6. Clients reconcile local state with canonical server records.
7. Deletions propagate through tombstones.

PostgreSQL remains canonical.

### Required deletion safeguards

Implement the approved behavior:

- Dedicated sync_tombstones table.
- Per-device synchronization cursors.
- 30-day tombstone retention window.
- SYNC_CURSOR_EXPIRED for stale devices.
- Safe full-resynchronization procedure.
- Pending offline drafts must survive recovery.
- Never blindly wipe local databases.
- Deleted records must never be resurrected by stale clients.
- Account deletion takes precedence over pending uploads.
- Duplicate submissions must not produce duplicate records.

Define conflict behavior explicitly. Do not silently choose a destructive resolution strategy.

### Cursor expiration

When a device exceeds the approved 30-day synchronization window:

Return a structured SYNC_CURSOR_EXPIRED response.

The client must:
- Preserve pending local drafts.
- Reconcile uncommitted changes.
- Request a safe full synchronization.
- Replace synchronized cache data only after safe reconciliation.

Do not implement a simplistic cache reset.

### Local database responsibility

This milestone establishes the server-side contracts and synchronization foundations.

Do not pretend that native encrypted databases for all five clients have been implemented.

Local storage implementation belongs to the appropriate platform milestones, but the sync contract must support it.

## 9. WORKSTREAM 5 — AUTOMATED VERIFICATION AND CI

Expand the existing test suite.

The target is at least 30 meaningful tests, but quality and coverage matter more than raw count.

Include:

### Database
- Migration upgrade.
- Migration downgrade where safe.
- Metric seed verification.
- Constraint validation.
- Foreign-key integrity.

### Authentication
- Registration.
- Successful login.
- Invalid credentials.
- Password hashing.
- Token expiry.
- Refresh rotation.
- Refresh-token reuse detection.
- Token-family revocation.
- Logout.
- Session revocation.
- Rate limiting.

### Ingestion
- Valid measurements.
- Invalid metric.
- Invalid units.
- Unauthorized ownership.
- Duplicate submissions.
- Idempotent retries.
- Partial batch failures.
- Immutable corrections.

### Synchronization
- Initial synchronization.
- Incremental synchronization.
- Cursor advancement.
- Tombstone propagation.
- Duplicate batch retry.
- Conflict handling.
- Expired cursor behavior.
- Pending offline draft preservation.
- Deleted-record resurrection prevention.
- Account-deletion precedence.

### API and architecture
- Web/mobile routing boundaries.
- Shared service behavior.
- Authentication protection.
- OpenAPI export.
- Zero OpenAPI drift.
- No direct n8n database access.
- No sensitive health measurements sent to n8n.

### CI activation

Inspect the existing CI configuration.

If absent, introduce a practical GitHub Actions pipeline that:
- Sets up the supported Python version.
- Installs project dependencies.
- Runs linting and type checks where configured.
- Runs automated tests.
- Validates migrations.
- Checks OpenAPI drift.
- Verifies critical architectural boundaries.

Use test database credentials and secrets safely.

Never commit .env files, credentials, or real personal health information.

## 10. SECURITY AND PRIVACY REQUIREMENTS

These are mandatory:

- Never log passwords, access tokens, refresh tokens, or identifiable health measurements.
- Redact sensitive fields from exceptions and structured logs.
- Enforce ownership and authorization at service boundaries.
- Validate every client-submitted record.
- Apply rate limits to authentication and ingestion.
- Use secure random identifiers and cryptographic token generation.
- Ensure transaction safety.
- Prevent unauthorized cross-user data access.
- Do not expose database errors or stack traces to clients.
- Keep audit events useful without copying sensitive health payloads.
- Do not introduce direct n8n access to PostgreSQL or PHI.

Do not claim HIPAA or GDPR compliance based solely on these implementations.

## 11. IMPLEMENTATION SEQUENCE

Execute sequentially:

Workstream 1: Database Migration 002
Workstream 2: Shared Models and Schemas
Workstream 3: Authentication and Session Service
Workstream 4: Ingestion and Cross-Platform Sync
Workstream 5: Verification and CI

After each workstream:
- Run relevant tests.
- Inspect modified files.
- Resolve regressions before proceeding.
- Update implementation notes.

Do not skip verification to save time.

If a critical architectural contradiction, destructive migration risk, or unresolved security issue appears, stop the affected workstream and report it rather than inventing a solution.

## 12. DOCUMENTATION AND TRACEABILITY

Update documentation to reflect actual implementation status:

- PROGRESS.md
- TECHNICAL.md
- README.md
- Relevant architecture specifications
- API documentation
- Traceability Matrix
- Open Decision Register, only where actual decisions have been resolved

Distinguish:
- Implemented
- Partially implemented
- Planned
- Not implemented
- Blocked

Do not mark an item complete merely because its interface or placeholder exists.

Preserve the approved decisions in ADR-001.

Do not silently close the remaining 12 open decisions.

## 13. STRICTLY OUT OF SCOPE

Do not implement:

- Frontend UI or landing page.
- React Native application screens.
- Next.js application screens.
- Desktop client applications.
- Local encrypted database implementations.
- HealthKit or Health Connect integrations.
- ML model training or prediction.
- AI assistant features.
- Medical document processing.
- Family sharing.
- Monetization.
- n8n production workflows.
- Cloud deployment.
- Production infrastructure provisioning.

These will be addressed in subsequent milestones.

Do not change approved branding or design decisions.

## 14. GIT AND ENVIRONMENT SAFETY

- Work on a dedicated milestone branch created from the verified current dev baseline.
- Preserve existing user changes.
- Never overwrite uncommitted work.
- Do not modify .env credentials.
- Do not expose secrets in reports.
- Do not commit or push unless explicitly requested.
- Do not deploy.
- Do not run destructive database commands against the user's development database.
- Use isolated test databases for migration and integration verification.

## 15. FINAL ACCEPTANCE CRITERIA

Milestone 0.7 may be reported complete only when:

1. Migration 002 successfully upgrades the isolated test database.
2. Existing data and migration 001 remain intact.
3. All ten metric definitions are available and validated.
4. Authentication and session lifecycle are operational.
5. Refresh-token rotation and reuse detection are tested.
6. Controlled health-data ingestion works.
7. Web and Mobile API boundaries use shared domain services.
8. Cross-platform synchronization contracts are established.
9. Idempotency and duplicate prevention work.
10. Tombstone propagation works.
11. Expired cursor recovery preserves pending offline drafts.
12. Deleted records cannot be resurrected.
13. Ownership and authorization tests pass.
14. Full automated test suite passes.
15. OpenAPI export has zero unintended drift.
16. CI workflow is active and verified.
17. Documentation accurately reflects implementation.

A passing test suite does not override an unresolved critical security or data-integrity defect.

## 16. FINAL REPORT

Create:

docs/milestone_07_core_authentication_ingestion_sync_implementation_report.md

Archive the exact execution prompt under:

prompts/013_milestone_07_core_authentication_ingestion_sync.md

The final report must include:

1. Executive summary.
2. Actual starting branch and commit.
3. Implementation branch and resulting commit.
4. Files created, modified, and deleted.
5. Migration details and verification.
6. Authentication implementation.
7. Ingestion implementation.
8. Synchronization implementation.
9. Security safeguards.
10. API endpoints and OpenAPI changes.
11. Test results and coverage summary.
12. CI results.
13. Known limitations and outstanding risks.
14. Incomplete acceptance criteria.
15. Recommended next milestone.

Provide exact commands to reproduce verification locally.

Do not claim a feature is complete without evidence.

Do not commit or push.

At completion, stop and await Product Owner review before starting Milestone 0.8.

END OF AUTHORIZATION.

