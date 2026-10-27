Roger That. Milestone 0.2 is approved, subject to the following safeguards.

ARCHITECTURAL BASELINE
- Use VitalSense_SRS_v1.1.1_Merged.md as the active technical specification.
- Use VitalSense_PRD_v1.1.md for product context and traceability.
- Follow AGENTS.md and preserve all existing source documents.
- Backend: FastAPI, Python, PostgreSQL, SQLAlchemy, and Alembic where supported by verified dependency compatibility.
- Use a modular monolith: one deployable FastAPI application with distinct web and mobile API routers. Do not create separately deployed microservices in this milestone.
- PostgreSQL remains the authoritative server-side data store.
- Do not use Django.

STEP 1 — ARCHIVE THE PROMPT
Save this exact prompt as prompts/004_milestone_02_backend_core.md. Archive the prompt only, not the surrounding conversation.

STEP 2 — VERIFY THE ENVIRONMENT
Inspect available Python interpreters and package-manager configuration. Prefer a stable Python 3.12 environment for this milestone, but verify dependency support before committing to exact versions. Do not change the machine-wide Python installation or execution policy.
If the compatible interpreter is unavailable, stop before installing dependencies and report the blocker and safest next step.

STEP 3 — PLAN BEFORE SCHEMA IMPLEMENTATION
Review DATA-001–DATA-005, relevant ARCH, SEC, IF-API, IF-CLIENT, and NFR-OBS requirements, plus relevant entries in the Open Decision Register.
Before creating migrations, produce a concise schema proposal describing:
- Account and person ownership relationships.
- Metric definition registry and units/data types.
- Health-record identity, timestamps, provenance, and source references.
- Audit-event ownership and minimum metadata.
- Foreign keys, uniqueness, indexes, and deletion implications.
- Which elements are required now versus deferred.
Flag any unresolved decision that affects the proposed schema.
Do not silently invent fields or behavior.

STEP 4 — IMPLEMENT THE APPROVED BACKEND FOUNDATION
Subject to compatibility and the schema review:
- Create packages/python-common as an installable shared Python package where appropriate.
- Add typed configuration and safe environment-variable validation.
- Add structured JSON logging with correlation/request IDs, avoiding sensitive health data and secrets in logs.
- Create one FastAPI application with distinct web and mobile router namespaces.
- Implement health/readiness endpoints and a consistent API error envelope aligned with the SRS.
- Configure PostgreSQL connectivity and session lifecycle with safe transaction boundaries.
- Configure Alembic and create only the reviewed baseline migration.
- Provide deterministic synthetic fixtures for tests only, with no real health data.
- Export an OpenAPI schema reproducibly and document the generation command.

STEP 5 — TESTING AND SECURITY
Add tests for application startup, health/readiness behavior, API error envelopes, configuration validation, database connection handling, and migration upgrade/downgrade where a test PostgreSQL instance is available.
Test unauthenticated behavior and authorization boundaries only to the extent supported by the approved design; do not claim complete authentication or authorization has been implemented.
Do not log credentials, tokens, or health-record payloads. Do not introduce real secrets or commit/push changes.

STEP 6 — SCOPE LIMITS
Do not implement full authentication, production JWT/session issuance, health ingestion workflows, native mobile functionality, offline sync, encryption/key management, or future AI/ML features in this milestone unless a specific requirement is explicitly approved first.
Do not deploy the application.
Do not claim checks passed unless they were actually executed.
If Docker/PostgreSQL or a compatible interpreter is unavailable, implement only the independent portions that can be safely verified and clearly report the blocker. Do not fabricate database test results.

STEP 7 — REPORT AND STOP
Report:
1. Files created or modified.
2. Schema proposal and how it maps to SRS requirement IDs.
3. Dependency versions and compatibility evidence.
4. Commands executed and their actual results.
5. Tests passed, failed, skipped, or blocked.
6. Remaining open decisions and known risks.
7. The next recommended milestone.

Stop after Milestone 0.2 and wait for approval. Do not expand scope autonomously.
