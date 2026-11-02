# VitalSense — Full-Scope Implementation Sprint Kickoff & Audit (Urgent 10h Deadline)

## Prompt Text

```text
URGENT DEADLINE UPDATE:

The developer has less than 10 hours available.

Optimize the entire execution plan for maximum genuine, working functionality
within this time.

Do not spend excessive time producing documentation or repeating audits.
Perform a focused repository audit and immediately identify reusable
implementations and critical blockers.

Allocate no more than 45 minutes to initial auditing.

After the audit:
- Prioritize end-to-end functionality.
- Reuse existing components and services.
- Parallelize independent work safely.
- Avoid unnecessary redesigns and refactoring.
- Implement all five platform foundations where feasible.
- Prioritize working Web and Android user journeys.
- Establish iOS, Windows and macOS buildability.
- Implement AI/ML foundations without pretending untrained models
  provide reliable predictions.
- Preserve security, privacy and data integrity.

Do not skip tests or claim unverified functionality is complete.

Return a short actionable report and begin implementation immediately
after the critical preflight.


You are the lead software architect, senior full-stack engineer, mobile engineer,
ML engineer, security engineer, and QA lead for VitalSense.

PROJECT:
VitalSense — a premium, privacy-first personal health intelligence platform.

DEADLINE:
2 November 2026.

OBJECTIVE:
Prepare the existing repository for an aggressive full-scope implementation
sprint. The target is the complete original VitalSense vision, including:

1. Web application.
2. Android application.
3. iOS application.
4. Windows application.
5. macOS application.
6. Shared backend and PostgreSQL data platform.
7. Health ingestion and automatic tracking.
8. Offline-first synchronization.
9. Analytics and visualizations.
10. AI-generated daily insights.
11. ML-based health trend forecasting.
12. External health integrations.
13. Family health management.
14. Medical records and responsible medical intelligence.
15. Workout, exercise, anatomy and muscle activity features.
16. Privacy, security, monitoring and deployment.

IMPORTANT:
Do not claim that the entire platform can be made production-ready in
one day. Your task is to maximize genuine implementation while preserving
correctness, security, architecture and testability.

EXISTING PROJECT CONTEXT:

Workspace:
E:\Projects\VITALSENSE

GitHub:
https://github.com/vinaykounchi101-pixel/VITALENSE

Latest known branch:
milestone-0.7.1.1-auth-retention-corrections

Latest known commit:
17ccaf8be2284a466b714246e11764053a39abea

Previous base branch:
milestone-0.7.1-security-data-integrity

Next planned branch:
milestone-0.7.1.2-sync-integrity-verification

The previous work includes core authentication, health ingestion,
sync infrastructure, security corrections, password-reset single-use
handling, web token omission, rate limiting and retention operations.

FIRST: REPOSITORY PREFLIGHT

1. Inspect the actual Git working tree.
2. Identify the current branch and commit.
3. Check for uncommitted changes and untracked files.
4. Inspect all existing apps, packages, migrations, tests and documentation.
5. Read PRD, SRS, ADR-001, architecture documentation, PROGRESS.md,
   TECHNICAL.md and previous milestone reports.
6. Do not overwrite or discard existing work.
7. Do not assume the supplied commit is still the current HEAD.
8. Verify the remote and branch state before creating or switching branches.

SECOND: MILESTONE 0.7.1.2

If this milestone has not already been completed, continue it using:

Branch:
milestone-0.7.1.2-sync-integrity-verification

Base:
milestone-0.7.1.1-auth-retention-corrections

Expected base commit:
17ccaf8be2284a466b714246e11764053a39abea

If the branch already exists, inspect it and resume safely.
Do not recreate or overwrite existing work.

Resolve and test:

- Tombstone resurrection protection must not depend on deleted
  HealthRecord rows.
- Deleted records must not reappear through replayed device_record_id
  or supersedes_record_id.
- Full resync must distinguish server records, pending offline drafts
  and deleted records.
- Cursor expiry must preserve pending offline changes.
- Tombstone retention must not introduce record resurrection.
- Concurrent password-reset confirmation must allow exactly one success.
- Retention operations must have safe single-runner deployment guidance.

Use real PostgreSQL integration tests where required.
Do not replace integration tests with mocks.

THIRD: FULL-SCOPE IMPLEMENTATION AUDIT

Create a feature inventory covering all five platforms and all product
modules.

For every feature record:

- Existing implementation.
- Missing implementation.
- Backend dependency.
- Frontend dependency.
- Database dependency.
- Integration dependency.
- Automated test coverage.
- Deployment status.
- Whether functionality is real, partial or mocked.
- Priority and estimated implementation effort.

Identify reusable code before creating anything new.

FOURTH: EXECUTION ARCHITECTURE

Preserve the approved decisions:

- Shared identity and canonical health data.
- Independent platform clients.
- PostgreSQL as canonical data store.
- Offline mobile database and safe synchronization.
- SQLCipher AES-256 SQLite for native local health storage.
- Platform secure key storage.
- Web IndexedDB and Web Crypto encryption.
- Modular backend boundaries.
- Clients never access PostgreSQL directly.
- n8n is only an external workflow orchestrator.
- Backend owns PHI, validation, canonical writes, analytics and ML.
- Predictions must never be presented as diagnoses.

Do not silently change approved decisions or open SRS decisions.

FIFTH: IMPLEMENTATION STRATEGY

Create a dependency-ordered sprint backlog.

Prioritize:
1. Backend integrity.
2. API contracts.
3. Shared data models.
4. Web experience.
5. Mobile experience.
6. Desktop experience.
7. Analytics and AI.
8. ML forecasting.
9. Family and medical modules.
10. Fitness and exercise modules.
11. Security and deployment verification.

Use parallel work only where dependencies allow it.
Do not allow multiple agents to edit the same files concurrently.
Do not create duplicate implementations of shared functionality.

SIXTH: QUALITY REQUIREMENTS

- Run actual tests.
- Run database migrations.
- Verify API contracts.
- Verify platform builds.
- Verify authentication and authorization.
- Verify offline sync and conflict handling.
- Verify data isolation.
- Verify privacy and deletion workflows.
- Identify all mocked or incomplete features.
- Never claim an unexecuted test passed.
- Never commit secrets or credentials.

SEVENTH: GIT RULES

- Never force push.
- Never rewrite main or dev history.
- Never merge into main or dev without approval.
- Use isolated feature branches.
- Commit only verified work.
- Preserve all user modifications.
- Do not deploy unfinished or insecure code.

DOCUMENTATION:

Create:

docs/full_scope_sprint/
  REPOSITORY_AUDIT.md
  FEATURE_COMPLETION_MATRIX.md
  DEPENDENCY_MAP.md
  SPRINT_EXECUTION_PLAN.md
  RISKS_AND_BLOCKERS.md

Archive this prompt in prompts/.

Update PROGRESS.md and TECHNICAL.md only with verified facts.

FINAL REPORT:

Return:

1. Actual branch and commit.
2. Repository state.
3. Existing feature inventory.
4. Milestone 0.7.1.2 status.
5. Critical blockers.
6. Exact feature completion matrix.
7. Recommended parallel implementation tasks.
8. Estimated time for each remaining task.
9. Actual test and build results.
10. What can realistically be completed by the deadline.

Do not start unrelated feature implementation before this audit
and the critical backend integrity checks are complete.

Begin with repository preflight.
```

