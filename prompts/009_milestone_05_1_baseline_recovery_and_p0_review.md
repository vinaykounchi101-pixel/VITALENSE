VitalSense — Milestone 0.5.1: Baseline Recovery & P0 Decision Review

You are working on the existing VitalSense repository:

https://github.com/vinaykounchi101-pixel/VITALENSE

Act as a senior software architect, backend engineer, security reviewer, QA engineer, and technical documentation maintainer.

The purpose of this milestone is to establish a trustworthy development baseline, reconcile architecture inconsistencies, and prepare the critical product-owner decisions for explicit review.

This milestone does not authorize feature implementation. Do not begin authentication, ingestion, sync, mobile scaffolding, or schema-changing work.
1. Mandatory operating rules
- Inspect the existing repository, current branch, working tree, recent commits, and project instructions before making changes.
- Work only in the existing VITALENSE workspace. Do not switch to or modify another project.
- Read the existing PRD, merged SRS, open-decision register, architecture decision workshop, traceability matrix, README.md, PROGRESS.md, TECHNICAL.md, and relevant files under prompts/.
- Treat existing decisions marked OPEN as unresolved. A recommendation, checkbox, or generated report is not product-owner approval.
- Preserve the existing architecture and document history. Do not silently replace earlier requirements or make incompatible decisions.
- Archive this exact prompt in prompts/, using the next available sequential filename.
- Never expose, print, or commit .env values, credentials, tokens, private keys, or real health information.
- Do not commit, push, deploy, or perform destructive Git operations.
2. Phase A — Verify and recover the development environment
Investigate the reported error:

ModuleNotFoundError: No module named 'vitalsense_common'

The reported cause is an editable-install reference affected by the workspace directory rename from VITALENS to VITALSENSE. Treat this as a hypothesis until verified.

Tasks:
1. Inspect pyproject.toml, workspace package definitions, Python package source, .venv interpreter, installed distributions, and editable-install metadata.
2. Identify the actual cause of the import failure. Check for incorrect paths, package discovery problems, missing __init__.py files where required, and mismatched Python environments.
3. Apply the smallest safe local fix necessary to restore the intended workspace installation.
4. Do not change package APIs, introduce unrelated dependencies, or rewrite project configuration without demonstrated need.
5. Run the existing test suite using the project's documented test command and correct interpreter.
6. Run relevant import checks and inspect the generated OpenAPI contract.
7. If database access is available, inspect migration status and verify migration behavior only against the explicitly configured local development/test database. Never run destructive tests against an unidentified or production database.
8. If PostgreSQL or another required dependency is unavailable, report the blocker honestly; do not claim a migration test passed.
Record the exact commands, exit codes, test totals, failures, interpreter path, and any environmental limitations.

Acceptance criteria:
- vitalsense_common imports successfully from the intended environment.
- Existing tests run to completion, or a specific remaining blocker is documented with evidence.
- No historical test count is presented as a current result unless reproduced.
- No real health data or secrets are used.
3. Phase B — Reconcile the architecture conflict
Inspect the authoritative architecture documents and prior project decisions.

The project has previously expressed a preference for independent web and mobile platform backends or service boundaries, while sharing user identity and canonical health data. The recent workshop recommends a single co-deployed FastAPI modular monolith with separate Web and Mobile API namespaces.

Do not assume either interpretation is approved merely because it appears in the latest report.

Prepare an architecture comparison covering:
- One FastAPI deployment with distinct Web and Mobile API namespaces.
- Separate web-facing and mobile-facing backend services sharing identity and canonical health data.
- The boundary between service separation and independent data ownership.
- PostgreSQL ownership, migrations, shared contracts, authorization, deployment, operational complexity, and cost.
- How each option supports offline mobile sync, future family health management, medical records, and ML/analytics.
- Whether separate services would add meaningful value now or simply create unnecessary operational overhead.
Identify the exact existing documents that conflict, quote or summarize their supported positions accurately, and propose a recommended resolution.

Do not silently change the approved architecture, PRD, SRS, database schema, or API contracts. Record the architecture decision as PENDING PRODUCT-OWNER APPROVAL.
4. Phase C — Review the critical P0 decisions
Review at least these decisions in the existing decision register and workshop:

OD-01 — Phase 1 metric set
- Clarify supported metrics versus guaranteed collection capability.
- Separate phone-only capabilities, wearable/OS-dependent metrics, external imports, and manual entry.
- Prevent fabricated zero values when data is unavailable.
OD-03 — Phase 0 exit criteria
- Separate gates applicable to the current foundation from gates that can only be tested after sync exists.
- Define objective evidence for every gate.
OD-04 — Manual entry and corrections
- Evaluate revision lineage, superseded records, duplicate prevention, auditability, and analytics behavior.
- Do not prescribe schema changes before approval.
OD-07 — Raw ingestion retention
- Evaluate retention duration, normalized record retention, audit metadata, account deletion, backup expiry, and restore reconciliation.
- Identify which requirements need legal/privacy review rather than assuming one retention duration is universally correct.
OD-14 — Deletion propagation and offline sync
- Evaluate tombstones, client cursors, idempotency, stale devices, expired tombstones, full-resync requirements, retries, and deleted-record resurrection.
- Explicitly explain why a fixed 30-day tombstone lifetime may fail if a device remains offline longer.
- Recommend a safe recovery strategy before schema design.
OD-16 — Platform and OS support
- Verify proposed minimum OS versions and health-platform assumptions against the existing Expo/native architecture.
- Distinguish confirmed capabilities from assumptions requiring prototype verification.
OD-17 — Mobile local database encryption
- Assess SQLCipher/SQLite compatibility with the intended Expo workflow, native builds, key storage, key loss, logout, device backup, and local data eviction.
- Do not claim compatibility without evidence.
OD-18 — Authentication and sessions
- Evaluate application-owned authentication, password hashing, access-token expiry, refresh-token rotation and reuse detection, revocation, password recovery, brute-force protection, browser token storage, mobile token storage, and audit events.
- Treat Argon2id and JWTs as design choices to evaluate, not a complete security design by themselves.
OD-19 — Hosting and service topology
- Resolve the architecture inconsistency described in Phase B.
- Compare realistic deployment options without assuming any provider or paid plan has been approved.
OD-22 — Automation and n8n
- Define what n8n may schedule or notify about.
- Prevent it from becoming the authoritative health-data writer.
- Evaluate PHI exposure through workflow payloads, credentials, execution history, logs, and notification channels.
For each decision, document:
1. Current recorded status.
2. Existing requirements and evidence.
3. Available options.
4. Consequences and trade-offs.
5. Recommended option and rationale.
6. Dependencies and risks.
7. Exact question requiring owner approval.
Recommendations must remain clearly distinguished from approved decisions. Do not mark any decision APPROVED.
5. Phase D — Traceability audit
Inspect docs/VitalSense_SRS_v1.1.1_Traceability_Matrix.csv and its authoritative source documents.

The prior audit reported 348 rows with placeholder PRD mappings and 23 placeholder test definitions. Verify those numbers rather than copying them blindly.

Tasks:
- Preserve the original requirement IDs and matrix structure wherever possible.
- Map requirements to actual PRD sections only when the source supports the mapping.
- Map SRS requirements to appropriate verification methods and acceptance criteria when sufficient information exists.
- Mark ambiguous, missing, conflicting, or unsupported mappings explicitly.
- Identify duplicate IDs, orphan requirements, inconsistent terminology, and contradictory requirements.
- Do not fabricate requirements, tests, acceptance criteria, or implementation evidence.
- Distinguish specification coverage from code implementation and executed test coverage.
If the full mapping cannot be completed safely within this milestone, deliver a measured audit and a prioritized remediation plan instead of filling cells with guesses.
6. Phase E — CI preparation
Inspect repository tooling, Python version constraints, package layout, current test commands, and existing GitHub configuration.

Prepare a minimal CI proposal that checks the same verified quality gates as local development, including relevant tests, imports, lint/type checks if already configured, and OpenAPI consistency where practical.

You may create a draft workflow only if it is safe, minimal, and does not depend on unavailable secrets or unapproved infrastructure. If workflow creation would require assumptions, provide the proposed workflow and explain what remains unresolved.

Do not add unnecessary dependencies, deployment jobs, secrets, or release automation. Do not deploy or enable any workflow externally.
7. Required deliverables
Update or create only the files needed for this milestone:
1. Sequential prompt archive under prompts/.
2. docs/milestone_05_1_baseline_recovery_and_p0_review_report.md
   - Baseline and Git state.
   - Root cause of the package installation failure.
   - Exact test and verification results.
   - Architecture inconsistency analysis.
   - P0 decision review.
   - Traceability audit results.
   - CI readiness assessment.
   - Blockers, risks, and next actions.
3. Update docs/architecture/decision_workshop.md only where needed to clarify options and owner questions; retain OPEN/PENDING statuses.
4. Update PROGRESS.md with evidence-based progress and remaining blockers.
5. Add a draft CI workflow only if the checks and configuration are genuinely ready.
Avoid duplicate reports, unnecessary document restructuring, and unrelated cleanup.
8. Explicitly prohibited work
Do not implement:
- User registration, login, authentication middleware, or token storage.
- Database migration 002 or any schema-changing migration.
- auth_credentials, auth_refresh_tokens, sync_tombstones, or revision-lineage schema.
- Health ingestion, manual-entry APIs, batch sync, or deletion endpoints.
- Web/mobile application scaffolding.
- AI, ML, prediction, or family-health features.
- Any production deployment or external infrastructure changes.
Do not commit or push. Do not mark owner decisions approved. Do not treat recommendations as requirements. Do not make destructive changes to the database or Git history.
9. Final verification and response
Before finishing:
- Review git diff and git status.
- Confirm that no application features, schema definitions, migrations, or API contracts were changed.
- Confirm that no secrets or personal health information were exposed.
- Run all safe relevant checks again after any modifications.
- List every changed or created file and explain why it changed.
- Report the current branch and starting commit.
- Report commands and actual results, including failures.
- List all P0 decisions still requiring explicit product-owner approval.
- Recommend the next smallest independently verifiable milestone.
If a task cannot be verified, label it NOT VERIFIED. If a task is blocked, explain the blocker. Do not claim completion without evidence.

Stop after delivering the report and owner decision questions. Wait for explicit product-owner approval before beginning implementation work.

