# VitalSense — Milestone 0.5: Product Owner Decision Sign-off

## 1. Role and operating mode

Act as the senior technical architect, product requirements analyst,
security-conscious backend engineer, and repository auditor for VitalSense.

Repository:
https://github.com/vinaykounchi101-pixel/VITALENSE

Work from the existing local repository and its current Git branch.
Do not confuse this project with any other repository.

This is a DECISION AND DOCUMENTATION MILESTONE.

Your task is to prepare the unresolved product and architecture decisions
for explicit owner approval. Do not implement new application features,
perform migrations, deploy services, or push commits during this milestone.

The repository is the source of truth for existing implementation.
Actual files and executable verification take precedence over stale
documentation or unverified historical progress reports.

## 2. First: inspect the repository

Before changing anything:

1. Inspect the current branch, working-tree status, latest commit,
   upstream tracking state, and recent commit history.
2. Confirm that you are operating in the VITALENSE repository.
3. Inspect the prompts/ directory and identify the next available
   sequential prompt filename.
4. Read the current versions of:
   - README.md
   - PROGRESS.md
   - TECHNICAL.md
   - VitalSense PRD v1.1
   - Merged SRS v1.1.1
   - Open Decision Register, OD-01 through OD-22
   - docs/architecture/decision_workshop.md
   - SRS traceability matrix
   - relevant changelog and validation reports
5. Inspect the actual backend entrypoints, API routers, configuration,
   SQLAlchemy models, database migration, tests, OpenAPI contract,
   .gitignore, environment examples, and CI configuration.
6. Establish which milestones are supported by repository evidence.
   Do not treat a report saying a test passed as proof that it passes now.

Do not overwrite or regenerate existing documents before inspecting them.

## 3. Establish a verified baseline

Produce a concise audit separating:

- Verified in repository
- Reported by documentation but not independently verified
- Unverified or contradictory
- Open decision
- Blocker
- Recommendation

Check, at minimum:

- Whether README.md and PROGRESS.md agree about project status.
- Whether the recorded current commit matches the actual Git state.
- Whether the existing PRD is linked to the SRS requirements.
- Whether the traceability matrix contains real PRD references,
  testable acceptance criteria, and honest verification statuses.
- Whether OD-01 through OD-22 have explicit owner-approved decisions.
- Whether the current schema's foreign keys, cascades, raw payload
  storage, idempotency constraints, and indexes match the specifications.
- Whether account/person ownership and authorization boundaries are defined.
- Whether offline deletion can be reconciled without resurrecting deleted data.
- Whether mobile encryption and key management are feasible on the
  intended Expo/native build targets.
- Whether the project has automated CI for tests, migrations, and contracts.
- Whether environment examples and logs avoid exposing secrets or health data.

Do not claim that application code is complete merely because a directory,
placeholder, interface, schema, or document exists.

## 4. Review the open decisions

Review every decision from OD-01 through OD-22 in the existing register.
Do not silently omit decisions or invent new decision IDs.

For each decision, record:

- Existing decision ID and exact question.
- Current status and any previous owner-approved choice.
- Available options, where supported by existing documentation.
- Relevant dependencies and trade-offs.
- Consequences for schema, API contracts, security, privacy, clients,
  deployment, cost, testing, and future milestones.
- Your recommended option and concise rationale.
- Whether the decision blocks implementation.
- The exact approval required from the product owner.

Keep recommendations separate from approved decisions.

Never convert an OPEN decision into APPROVED simply because an option
looks technically reasonable.

If existing documents conflict, preserve the conflict and explain it.
Do not silently reconcile the conflict by choosing one version.

## 5. Decisions that require particular scrutiny

Give special attention to the following existing decision IDs.
Verify their exact wording and status in the register before interpreting them.

### OD-01 — Phase 1 metrics

Evaluate the currently seeded provisional metrics:
steps, heart rate, sleep sessions, active energy, and workouts.

Distinguish metric definitions from actual device/source support.
Document the implications of adding weight, blood pressure, SpO2,
calories, and other supported measurements.

Do not assume that every metric is automatically available from a phone.

### OD-07 — Raw payload retention

Document the lifecycle of raw provider payloads, normalized health records,
derived analytics, logs, exports, backups, and deletion requests.

Identify data minimization, retention, access control, and deletion risks.
Recommend an explicit retention policy for owner approval without
inventing legal compliance claims.

### OD-14 — Deletion and offline synchronization

Analyze how record/account deletion interacts with:

- Offline mobile operation queues
- Delayed sync requests
- Retries and duplicate submissions
- Tombstones or deletion markers
- Foreign-key cascade behavior
- Backups and eventual cleanup

Ensure the design prevents deleted health records from being recreated
by a stale offline device.

Do not modify migrations in this milestone.

### OD-17 — Mobile database encryption

Evaluate the actual intended mobile build targets and Expo/native constraints.
Address local database encryption, secure key storage, device loss,
logout, local cache cleanup, and offline availability.

Do not claim encrypted SQLite is implemented unless repository evidence
proves it.

### OD-18 — Authentication

Compare the options supported by the project requirements, including
managed identity and application-owned authentication where relevant.

Evaluate security responsibility, account recovery, session handling,
authorization integration, operational cost, portability, and free-tier
constraints.

Do not implement authentication or select an identity provider without
explicit owner approval.

### Deployment and automation decisions

Review the relevant existing decision IDs for deployment, service topology,
budget, and n8n/automation.

Preserve the intended architecture: independent web and mobile clients,
shared identity and health data, PostgreSQL as the authoritative store,
and a maintainable backend with clear API boundaries.

Do not introduce microservices, paid dependencies, or a new hosting provider
without a documented reason and owner approval.

## 6. Prepare an owner decision workshop

Create a practical decision document that allows the owner to approve,
reject, defer, or request changes to recommendations.

Prioritize decisions into:

- P0: must be settled before security-sensitive implementation or
  schema changes.
- P1: needed before the affected feature is implemented.
- P2: can remain explicitly deferred without blocking the first vertical slice.

Explain dependencies between decisions.

For each P0 decision, provide a concise recommendation and its rationale.
Where multiple reasonable choices exist, explain the trade-off rather
than presenting a recommendation as an established fact.

Do not force the owner to decide every future-phase feature now.

Preserve future scope for family health management, medical records,
responsible medical intelligence, analytics, and ML forecasting.
Health predictions must not be described as diagnoses.

## 7. Traceability and documentation quality

Audit the traceability matrix against the actual PRD and SRS.

Do not fabricate PRD section references, acceptance criteria, test results,
or implementation evidence.

Identify missing mappings and recommend a repair plan. If you update the
matrix during this milestone, only make mappings directly supported by
the documents and clearly mark verification as not executed where applicable.

Separate these statuses:

- Requirement defined
- Design approved
- Implemented
- Automated test exists
- Test executed and passed
- Independently verified
- Deferred

Do not use one status as a substitute for another.

Identify stale documentation, broken local file:// links, incorrect commit
references, and inconsistent milestone descriptions. Correct only
documentation that can be updated without resolving an owner decision.

## 8. Required deliverables

Create or update the following only after inspecting existing paths and
conventions:

1. The next sequential prompt archive under prompts/.
2. A milestone 0.5 decision workshop document under docs/architecture/.
3. A concise milestone report under docs/ or the existing reporting location.
4. A list of documentation/traceability inconsistencies and recommended fixes.
5. A prioritized list of decisions requiring owner approval.
6. A proposed milestone 0.6 scope with explicit acceptance criteria.

Use existing filenames and document conventions where appropriate.
Do not create duplicate documents if an equivalent canonical file exists.

Update PROGRESS.md only if its conventions support recording a completed
documentation milestone, and distinguish completion of the workshop from
approval of the decisions themselves.

## 9. Constraints and safety

- Do not implement authentication, sync, health ingestion, frontend screens,
  AI, or ML features.
- Do not create or apply database migrations.
- Do not modify schema or API contracts.
- Do not install new dependencies.
- Do not edit .env or print credentials.
- Do not use real personal health information; synthetic examples only.
- Do not change remote branches, push, deploy, or publish.
- Do not commit unless explicitly authorized.
- Do not mark owner decisions as approved.
- Do not discard unrelated working-tree changes.
- Avoid broad refactors and unrelated cleanup.
- Keep the existing modular-monolith backend approach unless a documented
  architectural constraint demonstrates a need to revisit it.

If a decision cannot be resolved from available evidence, document the
question instead of guessing.

## 10. Verification and completion report

Before finishing:

1. Review the diff and confirm all changes are within scope.
2. Confirm no application behavior, database schema, or API contract changed.
3. Run only relevant, safe documentation validation checks if available.
4. Do not claim tests passed unless they were actually executed.
5. Report the branch, base commit, changed files, and verification performed.
6. List every P0 decision awaiting owner approval.
7. State what remains blocked and why.
8. Provide the proposed next step for Milestone 0.6.

Stop after producing the deliverables and report.
Wait for explicit owner review and approval before implementing
Milestone 0.6 or changing any approved architecture decision.

