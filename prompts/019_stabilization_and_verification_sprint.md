# VitalSense — Stabilization & Verification Sprint

## 1. Mission

You are working as the senior software architect, security engineer, and full-stack engineering team for VitalSense.

Your task is to perform a stabilization sprint on the existing repository. The previous full-scope sprint has been merged into `dev`, but independent review identified several critical implementation gaps.

Do not assume that a feature is complete because documentation or a previous report says it is complete. Inspect the actual code, implement missing functionality, run the relevant tests and builds, and report verifiable evidence.

This is a stabilization and verification task — not a redesign or rewrite.

## 2. Repository and Git rules

Repository:
https://github.com/vinaykounchi101-pixel/VITALENSE

Workspace:
E:\Projects\VITALSENSE

Starting branch:
`dev`

Starting commit:
`611a7216b5d03428b426d08102b35cabcedba507`

Before modifying anything:

1. Inspect the current Git status.
2. Confirm the current branch and HEAD.
3. Fetch the latest remote state.
4. Confirm that the expected starting commit is present.
5. Inspect the existing architecture, ADRs, migrations, implementation, tests, and progress documentation.

Create a new branch from the latest verified `dev` HEAD:

`stabilization/security-integrity-verification`

Do not work directly on `main` or `dev`.

Git restrictions:
- Never force-push.
- Never rewrite existing commits.
- Never delete existing branches.
- Do not merge into `dev` or `main`.
- Do not deploy.
- Do not modify unrelated user files.
- Commit changes to the new branch only.
- If the working tree contains uncommitted user changes, preserve them and do not overwrite them.

If the starting commit differs from the expected commit, inspect the differences and report them before proceeding.

## 3. Mandatory architecture constraints

Preserve the approved VitalSense architecture and decisions.

- Backend: FastAPI, Python, PostgreSQL.
- Web: Next.js, React, TypeScript, Tailwind CSS.
- Mobile: React Native + Expo.
- Desktop: existing Windows and macOS Tauri foundations.
- ML: Python, Pandas, NumPy, scikit-learn.
- n8n: external workflow orchestration only.
- PostgreSQL remains the canonical server-side data store.
- Clients must not connect directly to PostgreSQL.
- Preserve shared identity and canonical health records.
- Preserve independent platform clients and release pipelines.
- Preserve offline-first mobile architecture.
- Preserve existing API contracts unless a change is necessary and documented.

Do not replace React Native + Expo with Kotlin, SwiftUI, or another mobile framework.

Do not introduce new services or infrastructure merely for architectural preference.

Consult ADR-001 before changing any approved behavior.

## 4. Priority 0 — Permanent data integrity

Inspect the existing migration 005 and ingestion implementation.

Verify that source-record replay protection is permanent and concurrency-safe.

Requirements:

1. Enforce the unique source identity at the database level.
2. Preserve the intended uniqueness rule for:
   `(person_id, source_name, source_record_id)`
3. Ensure nullable source IDs follow the documented behavior.
4. Handle concurrent ingestion attempts safely.
5. Handle duplicate requests without producing duplicate health records.
6. Preserve idempotency across retries.
7. Ensure deleted records cannot be resurrected by replaying old source records.
8. Verify tombstone behavior before and after retention cleanup.
9. Ensure a tombstone cannot be bypassed through a different ingestion path.
10. Preserve immutable correction semantics.

Add tests covering:

- First ingestion.
- Duplicate ingestion.
- Concurrent duplicate ingestion.
- Duplicate ingestion after deletion.
- Duplicate ingestion after tombstone retention cleanup.
- Null source IDs.
- Different source names with identical source IDs.
- Different people with identical source IDs.
- Correction and supersession behavior.
- Retry after transaction failure.

Never solve a replay problem by silently discarding legitimate records.

## 5. Priority 1 — Real encrypted mobile storage

The previous implementation of:

`apps/mobile/src/services/storage/sqlcipher.ts`

was found to use an in-memory JavaScript `Map`, not actual SQLCipher-backed persistent storage.

This is not acceptable as a production implementation.

Implement actual persistent encrypted SQLite storage using a compatible SQLCipher solution for the existing React Native + Expo architecture.

Requirements:

1. Use actual SQLCipher encryption, not an in-memory substitute.
2. Persist data across app restarts.
3. Encrypt the database at rest.
4. Generate and securely store database encryption keys.
5. Use Android Keystore for Android key protection.
6. Use iOS Keychain for iOS key protection.
7. Ensure logout and account switching do not expose another account's data.
8. Handle missing, invalid, or lost encryption keys safely.
9. Implement safe database initialization and migration behavior.
10. Preserve offline records and pending synchronization operations.
11. Never log encryption keys or sensitive health records.
12. Add tests for persistence, initialization, key handling, logout, and failure recovery.

Important:

- Verify compatibility with the current Expo SDK and native build configuration.
- Use a compatible Expo development build/config plugin where necessary.
- Do not claim SQLCipher support merely because a package name contains `sqlcipher`.
- Inspect the actual native implementation and verify that encryption is enabled.
- If the current environment cannot build or verify native SQLCipher, document that limitation and mark the feature as blocked rather than pretending it is complete.

Also inspect mobile token storage. Access and refresh tokens must use appropriate platform-protected storage, not ordinary AsyncStorage or an unprotected JavaScript store.

## 6. Priority 1 — Real health-platform integrations

Inspect:

- `HealthConnectAdapter.ts`
- `HealthKitAdapter.ts`

The previous implementation reported availability and permissions as true while returning empty records.

Do not simulate successful integration.

Implement genuine platform capability checks and permission handling.

Android:
- Check whether Health Connect is installed and available.
- Check supported Health Connect versions.
- Request actual permissions for supported metrics.
- Read only metrics for which permission has been granted.
- Handle denied, revoked, unavailable, and unsupported states.
- Handle pagination and date ranges where supported.

iOS:
- Check actual HealthKit availability.
- Request the necessary read permissions.
- Read only supported metrics.
- Handle denied, unavailable, and unsupported states.
- Respect HealthKit's privacy behavior: an empty result must not be interpreted as proof that permission was denied.

For both:
- Normalize results into VitalSense canonical metric definitions and units.
- Preserve source metadata and measurement timestamps.
- Avoid duplicate imports.
- Handle timezone and daylight-saving boundaries.
- Handle partial permissions.
- Add appropriate tests.

If native integrations cannot be tested on the current machine, implement the genuine native integration code and clearly report what remains unverified.

Never return `granted: true` or `isAvailable: true` as a hardcoded placeholder.

## 7. Priority 1 — Docker and deployment correctness

Inspect:

- `infrastructure/docker/Dockerfile.api`
- `docker-compose.yml`
- API entrypoint and health routes.

Previously identified problems:

- Docker references `services.main:app`, while the actual API entrypoint is `services.api.main:app`.
- Docker healthcheck references `/api/v1/health`, while the actual health endpoint is `/health`.
- Fallback database credentials and security secrets are unsafe.

Fix these issues.

Requirements:

1. Verify the actual Python package structure.
2. Correct the API entrypoint.
3. Correct the healthcheck.
4. Ensure the container starts from a clean environment.
5. Add appropriate dependency installation and working-directory configuration.
6. Add health checks for required services.
7. Do not ship default production credentials.
8. Require strong secrets for production.
9. Fail safely when required production environment variables are missing.
10. Keep local development setup convenient through `.env.example`.
11. Never commit actual secrets.
12. Verify Docker Compose configuration.
13. Build the API image.
14. Start the relevant containers where the environment supports it.
15. Verify actual API health and database connectivity.

Do not claim a Docker deployment works merely because the YAML file parses.

## 8. Priority 1 — Privacy export and deletion completeness

Inspect the current privacy service and all relevant database models.

The previous export implementation omitted several data categories.

The export must account for all user-associated data, including:

- User and person profiles.
- Health records.
- Source records and relevant metadata.
- Medical records.
- Workout details.
- Daily insights.
- External import records.
- Relevant sync metadata.
- Other user-associated records introduced by the current schema.

Requirements:

1. Produce a complete machine-readable export.
2. Include a manifest describing exported categories and formats.
3. Preserve timestamps, units, source information, and relationships.
4. Avoid exporting secrets, password hashes, or authentication tokens.
5. Ensure export access is authenticated and authorized.
6. Test that every relevant data category is included.
7. Implement account deletion according to ADR-001.
8. Include associated analytics, predictions, caches, reports, and derived personal data in deletion.
9. Preserve required audit/deletion evidence without retaining unnecessary personal health information.
10. Ensure account deletion cannot be bypassed by pending offline uploads.
11. Verify deletion behavior and retention interactions.

Do not claim GDPR or HIPAA compliance solely because export and deletion functions exist.

## 9. Priority 2 — Desktop implementation verification

Inspect the existing Windows and macOS Tauri applications.

Previous reports described SQLCipher storage, but expected storage source files were not found at the previously reported paths.

Verify the actual repository structure.

For both platforms:

- Confirm the app builds.
- Confirm the frontend and Tauri integration work.
- Confirm secure token storage.
- Confirm encrypted local database implementation.
- Confirm API communication.
- Confirm logout and account switching.
- Confirm platform-specific key protection.
- Confirm error handling.

Do not create fake storage implementations or placeholder security claims.

If the current machine cannot build one platform, report the exact reason and provide the commands and environment required for verification.

Do not replace the existing desktop architecture without approval.

## 10. Priority 2 — API, web and mobile integration

Inspect every implemented feature and verify that the actual API routes, authentication, authorization, request schemas, and response schemas are consistent.

Check:

- Authentication.
- Health ingestion.
- Synchronization.
- Analytics.
- Daily insights.
- Forecasting.
- Medical records.
- Fitness and workouts.
- Family profiles.
- External imports.
- Privacy export and deletion.

Verify that the Web and Mobile API routers expose the correct functionality and enforce the correct permissions.

Do not assume that mounting a router means its endpoints work.

Check for:
- Incorrect route prefixes.
- Missing authentication dependencies.
- Missing person-level authorization.
- Inconsistent response formats.
- Missing pagination.
- Unhandled database errors.
- Unvalidated input.
- Sensitive information in logs.
- Broken API contract generation.

Preserve backward compatibility wherever possible.

## 11. Priority 2 — Documentation reconciliation

Review and update:

- `README.md`
- `PROGRESS.md`
- `docs/`
- `prompts/`
- Architecture and ADR documents.
- Feature completion documentation.
- Deployment instructions.
- Environment setup instructions.

Resolve the known documentation inconsistencies:

1. README references Kotlin/Jetpack Compose and Swift/SwiftUI, while the approved mobile architecture is React Native + Expo.
2. PROGRESS.md contains stale branch information referring to `sprint-full-scope-foundation`.
3. Feature completion claims must match actual implementation.
4. Desktop security claims must be evidence-based.
5. Docker instructions must match the corrected container configuration.
6. Any unavailable or missing report paths must be corrected.

Maintain a clear distinction between:

- Implemented and verified.
- Implemented but not verified.
- Partially implemented.
- Planned.
- Blocked.

Do not mark a feature complete just because a file, interface, or placeholder exists.

## 12. Testing and verification

Run all relevant checks and record actual outputs.

Backend:
- Full pytest suite.
- Database migration upgrade from a clean database.
- Database migration upgrade from the previous schema.
- API integration tests.
- Authentication and authorization tests.
- Ingestion and sync integrity tests.
- Privacy export and deletion tests.
- Retention tests.

Web:
- Dependency installation.
- TypeScript checks.
- Linting.
- Production build.
- API integration verification.

Mobile:
- Dependency installation.
- TypeScript checks.
- Expo configuration validation.
- Native development build where possible.
- SQLCipher verification.
- Health Connect/HealthKit verification where possible.

Desktop:
- Windows build where possible.
- macOS build where possible.
- Tauri configuration validation.
- Storage and authentication verification.

Infrastructure:
- Docker Compose validation.
- API image build.
- Container startup.
- Healthcheck verification.
- Database connectivity.

Also inspect GitHub Actions and ensure CI runs the appropriate checks.

Do not fabricate test counts, build results, screenshots, or successful deployment claims.

For every failed or skipped check, record:
- Exact command.
- Actual result.
- Reason.
- Whether it is an environment limitation or an implementation defect.
- Required next action.

## 13. Quality and security requirements

Throughout the sprint:

- Follow existing coding conventions.
- Avoid unnecessary dependencies.
- Avoid duplicate implementations.
- Use typed interfaces.
- Validate all external input.
- Use transactions for multi-record writes.
- Use parameterized database queries.
- Apply authorization at the person/account level.
- Avoid exposing health information in logs.
- Avoid secrets in source control.
- Preserve migration reversibility where practical.
- Add tests for every critical bug fixed.
- Do not weaken existing security controls to make tests pass.

## 14. Scope control

Prioritize work in this order:

1. Permanent replay/data integrity.
2. Real mobile encrypted storage and token security.
3. Real Health Connect and HealthKit behavior.
4. Docker and production secret correctness.
5. Complete privacy export and deletion.
6. Desktop implementation verification.
7. API integration and authorization.
8. Documentation and CI reconciliation.

If time or environment constraints prevent completion, do not rush or fake the remaining work.

Finish the highest-priority work safely, document remaining blockers, and leave the branch in a coherent state.

Do not remove features simply because they are difficult to complete.

Do not silently change the product scope.

## 15. Required deliverables

Create:

`docs/stabilization/FINAL_STABILIZATION_REPORT.md`

The report must contain:

1. Starting branch and commit.
2. New branch and final commit.
3. Files changed.
4. Database migrations added or modified.
5. Bugs identified.
6. Fixes implemented.
7. Tests executed and actual results.
8. Build results.
9. Security verification results.
10. Docker verification results.
11. Mobile native verification results.
12. Desktop verification results.
13. Remaining blockers.
14. Known limitations.
15. Features that remain planned.
16. Recommended next milestone.
17. Explicit statement of whether the branch is safe to merge.

Also create:

`docs/stabilization/FEATURE_VERIFICATION_MATRIX.md`

For every major feature, record:
- Platform.
- Implementation status.
- Verification status.
- Test evidence.
- Remaining gaps.

Archive this prompt in:

`prompts/`

Use a sequential prompt filename based on the existing naming convention.

Update `PROGRESS.md` with the actual current state.

## 16. Final instructions

Do not stop after producing an audit report. Implement the confirmed fixes.

Do not stop after editing files. Run the relevant tests and builds.

Do not claim success without evidence.

Do not merge, deploy, force-push, or change the main branch.

At the end, provide:

1. A concise summary of what was actually fixed.
2. The new branch name.
3. The final commit hash.
4. The exact tests and builds that passed.
5. The exact tests and builds that failed or could not run.
6. Remaining critical blockers.
7. Whether the branch is safe to merge.
8. The next recommended milestone.

VitalSense must be treated as a serious, privacy-first health intelligence platform. Correctness, security, data integrity, and honest verification take priority over the number of features marked complete.
