# VitalSense --- Software Requirements Specification (SRS)

**Document ID:** VS-SRS-001\
**Version:** 1.1.1\
**Status:** Merged revised draft — approval-gated decisions remain open\
**Date:** 27 October 2026\
**Product name:** VitalSense (provisional; branding is not finalized)\
**Source baseline:** VitalSense SRS v1.0.1 and the two candidate SRS v1.1.0 revisions: the user-uploaded Revision Bundle and the companion Review Package. The PRD itself was not available during this merge; PRD-to-requirement traceability remains explicitly unverified.

## Document purpose and conventions

This SRS translates the VitalSense PRD into requirements that can be
designed, implemented, tested, and traced. It defines target behavior
and architecture; it does not imply that every planned component ships
in the first release.

-   **MUST** = mandatory for the applicable phase.
-   **SHOULD** = strongly recommended; deviations need a documented
    reason.
-   **MAY** = optional.
-   **P0** = foundation/Phase 1 release-critical; **P1** = committed
    later phase; **P2** = future phase.
-   **OPEN** = requires a recorded decision before the relevant scope is
    frozen.
-   **FUTURE GATE** = must not be enabled until phase-specific evidence
    and approval exist.

A folder, mock, interface, or placeholder is not a completed capability.
A requirement is complete only when its verification evidence passes.


**Merge baseline note:** This v1.1.1 draft uses the user-uploaded v1.1.0 Revision Bundle as the structural baseline and incorporates the distinct detailed acceptance requirements from the companion v1.1.0 Review Package. Similar obligations were retained as linked, additive requirements only where they add testable behavior; no product policy or numeric target is considered approved solely by this merge.


------------------------------------------------------------------------

# 1. Introduction

## 1.1 Purpose and scope

VitalSense is a cross-platform personal health and wellness information
product. It brings permitted health and activity data together, presents
history and goals, and progressively adds AI summaries, validated ML
forecasts, automation, medical capabilities, and family health
management.

The system includes: - Web client: Next.js, React, TypeScript, Tailwind
CSS. - Mobile clients: React Native + Expo for Android and iOS, with
native platform integration where required. - Separate web-facing and
mobile-facing FastAPI APIs. - Shared identity and canonical health-data
domain capabilities. - PostgreSQL as the authoritative central store. -
Encrypted mobile-local storage and durable offline synchronization. -
Python ML training/evaluation and a separate approved inference path. -
n8n where viable, with application services retaining responsibility for
security and business rules. - Testing, deployment, monitoring, privacy,
and operational documentation.

## 1.2 Phase boundaries

  -----------------------------------------------------------------------
  Phase                   Intended scope          Boundary
  ----------------------- ----------------------- -----------------------
  Phase 0 --- deployable  Repository/tooling,     Foundation milestone,
  foundation              deployable client/API   not a completed
                          skeletons, identity and user-facing product.
                          data boundaries,        
                          database/migrations,    
                          provenance model,       
                          platform feasibility    
                          proof, CI and safety    
                          foundations.            

  Phase 1 --- personal    Onboarding, selected    First intended
  tracking                source                  user-facing release.
                          connections/import,     Exact metric/source
                          source                  list remains OPEN. AI
                          status/freshness,       summaries and
                          dashboard, history,     predictive ML are not
                          goals, deterministic    assumed.
                          calculations, selected  
                          manual entry, privacy   
                          controls and            
                          notification            
                          preferences.            

  Phase 2 --- AI and      Daily briefings, weekly Requires AI, privacy,
  automation              reviews, non-diagnostic cost, and operational
                          personalized            release gates.
                          suggestions, approved   
                          AI chat if selected,    
                          automated workflows,    
                          reports and reliability 
                          monitoring.             

  Phase 3 --- predictive  Validated               Each prediction
  ML                      activity/sleep trends,  requires suitable data,
                          personal                baseline comparison,
                          baselines/deviations,   evaluation,
                          selected goal-progress  uncertainty, monitoring
                          estimates.              and rollback.

  Phase 4 --- medical     Selected medical        Committed future phase;
  records/intelligence    record/document import, no feature enabled
                          longitudinal            before medical safety
                          measurements,           and applicable
                          user-reviewed           regulatory review.
                          summaries, potentially  
                          concerning-pattern      
                          detection where         
                          validated.              

  Phase 5 --- family      Person-specific         Planned future phase;
  health                  records, explicit       not part of initial
                          sharing, caregiver      release.
                          roles, consent,         
                          revocation and access   
                          isolation.              
  -----------------------------------------------------------------------

## 1.3 Out of scope for Phase 1

Unless explicitly approved, Phase 1 excludes interactive AI chat,
predictive forecasts, diagnosis/treatment advice, medical document
interpretation, full family management, unselected third-party
integrations, and claims that a typical phone can measure every health
metric. Private health records must not be used for shared-model
training without separate governance and consent. Models must not be
automatically promoted merely because training completed.

## 1.4 Definitions

  -----------------------------------------------------------------------
  Term                                Definition
  ----------------------------------- -----------------------------------
  Source record                       A record received from a platform,
                                      device, service, document or user.

  Canonical health record             Normalized VitalSense record linked
                                      to a person, source, time, unit and
                                      provenance.

  Derived metric                      A deterministic calculation based
                                      on identified inputs.

  AI content                          Generated natural-language
                                      explanation or summary, not a
                                      measurement.

  ML prediction                       An estimate produced by an
                                      approved, versioned predictive
                                      model.

  Provenance                          Origin and transformation context
                                      for a record or derived output.

  Freshness                           Best available indication of how
                                      recently data was checked or
                                      synchronized; not necessarily
                                      measurement time.

  Idempotency                         Repeating an operation does not
                                      cause unintended duplicate effects.

  Release gate                        Evidence-based conditions required
                                      before a capability is enabled.
  -----------------------------------------------------------------------

## 1.5 Source hierarchy

1.  VitalSense PRD v1.1 is the product-intent baseline.
2.  Product-owner discovery decisions establish the selected stack and
    architecture direction.
3.  `FitTrack_Pro_Python_ML.docx`,
    `HealthSync_Personal_Wellness_Tracking_Application.docx`, and
    `Smart_Health_Card_Generator_Android_App_SQLite.docx` provide
    reference capabilities only. Their technology stacks and assumptions
    are not automatically adopted.

------------------------------------------------------------------------

# 2. Overall system description

## 2.1 Logical architecture

``` text
Web Client (Next.js) ──> Web-facing FastAPI API ──┐
                                                  ├──> Shared Identity
Mobile Client (Expo) ─> Mobile-facing FastAPI API ┤    Shared Health Data
  ├─ HealthKit / Health Connect                    │    Analytics / Notifications
  ├─ Encrypted local database + sync queue         │           │
  └─ Offline UI                                    └───────────┤
                                                              ▼
                                                    PostgreSQL source of truth
                                                              │
                                               Workers / n8n / approved AI & ML
```

These are logical boundaries. Not every component needs a separate
server/container from day one. Web and mobile APIs remain separate
client-facing boundaries; shared domain rules must not be duplicated.
Co-deployment is acceptable where cost-effective if responsibilities,
interfaces, security and tests remain explicit.

## 2.2 User classes

-   **Individual user:** manages their account, grants permissions,
    reviews records/goals and controls notifications.
-   **Administrator/operator:** performs restricted support and
    operational tasks under least privilege.
-   **Engineering/operations:** maintains deployment, monitoring,
    recovery and security; must not gain unrestricted access to health
    records by default.
-   **Future family member/caregiver:** Phase 5 role with explicitly
    granted, revocable access.
-   **Future medical/privacy reviewers:** review Phase 4 intended use,
    validation and release readiness.

## 2.3 Operating environment and constraints

-   Web: Next.js, React, TypeScript, Tailwind CSS.
-   Mobile: React Native + Expo, with native configuration/modules as
    required.
-   Backend: Python FastAPI.
-   Central data: PostgreSQL.
-   Local mobile data: SQLite-based or equivalent encrypted local
    database; exact package/key strategy is OPEN.
-   ML: Python, Pandas, NumPy, scikit-learn initially.
-   Automation: self-hosted n8n where viable, plus application-owned
    workers where needed.
-   Deployment: free-tier-first, not a promise of zero cost.

Health data access depends on platform APIs, permissions, source
availability and OS behavior. Background execution cannot be guaranteed
to run continuously. A typical phone cannot be assumed to measure SpO₂,
blood pressure, weight, continuous heart rate or sleep stages without a
compatible source. Experimental camera pulse estimation, if ever
enabled, must be validated and labeled experimental.

------------------------------------------------------------------------

# 3. Functional requirements

## 3.1 Identity and authentication

-   **FR-AUTH-001 (P0):** Support email-based account
    registration/sign-in.
-   **FR-AUTH-002 (P0):** Support Google and Apple sign-in where
    provider setup, platform rules and distribution requirements permit.
-   **FR-AUTH-003 (P0):** Use a shared identity across web and mobile so
    synchronized history belongs to one canonical account.
-   **FR-AUTH-004 (P0):** Require authentication for private records and
    reject unauthorized access server-side.
-   **FR-AUTH-005 (P0):** Enforce authorization on every private
    resource operation; hiding a UI control is not sufficient.
-   **FR-AUTH-006 (P0):** Implement secure session/token storage,
    expiry, refresh/revocation and sign-out behavior appropriate to each
    client.
-   **FR-AUTH-007 (P0):** Recovery flows must not unnecessarily disclose
    whether an arbitrary email has an account.
-   **FR-AUTH-008 (P0):** Sensitive administrative actions must be
    authorized and auditable.
-   **FR-AUTH-009 (P2):** The model must accommodate future
    person-specific access without assuming the account holder is always
    the person represented by every record.

## 3.2 Onboarding, consent and permissions

-   **FR-ONB-001 (P0):** Explain the purpose of each requested
    health-data category before or when permission is requested.
-   **FR-ONB-002 (P0):** Allow onboarding to continue with denied or
    partial permissions unless a documented feature dependency makes a
    permission essential.
-   **FR-ONB-003 (P0):** Distinguish granted, denied, restricted,
    unavailable, pending and failed states where determinable.
-   **FR-ONB-004 (P0):** Do not report a source as connected merely
    because a connection flow was opened/completed; reflect actual
    permission and integration state.
-   **FR-ONB-005 (P0):** Allow users to review/change relevant source
    and notification preferences.
-   **FR-ONB-006 (P0):** Handle revoked permissions as a normal state
    change.
-   **FR-ONB-007 (P0):** Show a clear empty state when no data exists;
    missing data must never be displayed as a real zero.
-   **FR-ONB-008 (P0):** Record relevant consent/permission state
    changes as needed for the approved privacy design without collecting
    unnecessary details.

## 3.3 Health sources and ingestion

-   **FR-DATA-001 (P0):** Provide an iOS HealthKit pathway for selected
    metrics, subject to permission and platform support.
-   **FR-DATA-002 (P0):** Provide an Android Health Connect pathway for
    selected metrics, subject to permission and platform support.
-   **FR-DATA-003 (P0):** Prefer native platform integrations;
    VitalSense must not require a separate health app or wearable for
    all functionality.
-   **FR-DATA-004 (P0):** Import only user-authorized data made
    available by the source.
-   **FR-DATA-005 (P0):** Validate source records before treating them
    as canonical.
-   **FR-DATA-006 (P0):** Preserve source identity, source record ID
    where available, event/measurement time, ingestion time, units and
    transformation provenance.
-   **FR-DATA-007 (P0):** Distinguish measurement time from sync time;
    never imply delayed data is real-time.
-   **FR-DATA-008 (P0):** Handle missing fields, invalid values,
    unsupported types, malformed payloads and partial imports without
    inventing values.
-   **FR-DATA-009 (P0):** Use idempotent ingestion so repeated imports
    do not create unintended duplicates.
-   **FR-DATA-010 (P0):** Distinguish imported, user-entered, corrected
    and derived records.
-   **FR-DATA-011 (P0):** Explain unavailable platform capabilities and
    offer manual/alternate paths where included.
-   **FR-DATA-012 (P0):** Expose connection/sync state and last
    successful sync time when known.
-   **FR-DATA-013 (P0):** Retry safe transient failures with bounded
    retries and log safe failure metadata.
-   **FR-DATA-014 (P1):** Add manufacturer or third-party integrations
    only after feasibility, permission, cost, privacy and maintenance
    review.
-   **FR-DATA-015 (P2):** Future medical document ingestion must
    validate file type/size, expose extraction uncertainty, preserve
    provenance, support user review and show failure states.

## 3.4 Metric policy

The long-term candidate set includes steps/movement, heart rate, sleep,
workouts, calories, SpO₂, blood pressure, weight/body measurements and
other supported metrics. The exact Phase 1 list is **OPEN (OD-01)** and
must be frozen after platform feasibility review.

  -----------------------------------------------------------------------
  Category                            Source rule and required behavior
  ----------------------------------- -----------------------------------
  Steps/movement                      Supported phone/platform source or
                                      compatible device; show
                                      source/time/freshness and respect
                                      background limitations.

  Workouts                            Supported source or user entry;
                                      preserve activity, duration, time
                                      and provenance.

  Heart rate                          Compatible device/service or
                                      validated method; do not claim
                                      typical phone-only continuous
                                      measurement.

  Sleep                               Supported source/device or selected
                                      manual entry; do not invent sleep
                                      stages or treat absence as zero.

  Calories                            Source-provided estimate or
                                      documented calculation with
                                      suitable inputs; label estimates
                                      and method.

  SpO₂, blood pressure, weight        Compatible device/source or
                                      selected manual/import path; no
                                      unsupported phone-only measurement
                                      claims.

  Experimental camera pulse           Optional only after validation;
                                      clearly labeled experimental and
                                      not medical-grade.
  -----------------------------------------------------------------------

-   **FR-METRIC-001 (P0):** Label each value as recorded, user-entered,
    calculated, AI-described or ML-predicted as applicable.
-   **FR-METRIC-002 (P0):** Keep missing, unavailable, invalid and stale
    data distinct from zero.
-   **FR-METRIC-003 (P0):** Store/map units consistently and display
    units; test conversions.
-   **FR-METRIC-004 (P0):** Maintain a metric registry describing
    canonical ID, value type, units, validation, time semantics and
    display rules.
-   **FR-METRIC-005 (P0):** Show unsupported metrics as unavailable/not
    connected rather than fabricated.

## 3.5 Data quality, provenance and corrections

-   **FR-QUAL-001 (P0):** Associate every record with the correct
    person/account boundary.
-   **FR-QUAL-002 (P0):** Preserve a traceable link to the source record
    or equivalent provenance.
-   **FR-QUAL-003 (P0):** Validate required fields, units, timestamps
    and supported value ranges.
-   **FR-QUAL-004 (P0):** Distinguish source, ingestion, normalization
    and correction times where applicable.
-   **FR-QUAL-005 (P0):** Document deterministic duplicate rules; do not
    silently merge meaningful conflicts.
-   **FR-QUAL-006 (P0):** Preserve original source data separately from
    a user correction according to policy.
-   **FR-QUAL-007 (P0):** Track method/version and inputs for derived
    metrics where appropriate.
-   **FR-QUAL-008 (P0):** Never write interpolated/fabricated chart
    values as measured records.
-   **FR-QUAL-009 (P1):** Surface useful quality warnings when data is
    sparse, conflicting or incomplete.
-   **FR-QUAL-010 (P2):** Medical records must preserve document/source
    provenance, extraction confidence where applicable and user
    review/correction history.

## 3.6 Dashboard, history and goals

-   **FR-UI-001 (P0):** Provide a coherent dashboard for approved Phase
    1 metrics and goals.
-   **FR-UI-002 (P0):** Show available historical records over approved
    periods.
-   **FR-UI-003 (P0):** Support create/view/update for goal categories
    approved for Phase 1.
-   **FR-UI-004 (P0):** Use deterministic application logic for
    arithmetic, units, aggregation and goal progress---not generative
    AI.
-   **FR-UI-005 (P0):** Provide empty, insufficient-data, stale and
    error states.
-   **FR-UI-006 (P0):** Distinguish recorded values, derived aggregates
    and predictions.
-   **FR-UI-007 (P0):** Show relevant time range and units.
-   **FR-UI-008 (P0):** Clearly communicate when data has not
    synchronized.
-   **FR-UI-009 (P0):** Web and mobile must share canonical metric
    definitions and calculation semantics.
-   **FR-UI-010 (P1):** Let users inspect source context when it
    materially affects interpretation.
-   **FR-UI-011 (P1):** Provide deliberate mobile/tablet/desktop layouts
    and accessible controls.

## 3.7 Manual entry

Exact Phase 1 categories are **OPEN (OD-04)**.

-   **FR-MAN-001 (P0, when included):** Manual entry must capture
    approved value, unit, event time and required context.
-   **FR-MAN-002 (P0):** Label manual records as user-entered, not
    source-imported.
-   **FR-MAN-003 (P0):** Validation errors must identify the problem and
    corrective action.
-   **FR-MAN-004 (P0):** Editing/deleting manual records must follow the
    approved data lifecycle and audit rules.
-   **FR-MAN-005 (P1):** Explain when a correction must be made in the
    external source rather than VitalSense.

## 3.8 AI summaries and assistant --- Phase 2

-   **FR-AI-001 (P1/FUTURE GATE):** Provide daily summaries and weekly
    reviews grounded in authorized available data.
-   **FR-AI-002 (P1/FUTURE GATE):** Distinguish recorded facts, interpretation,
    suggestions and uncertainty.
-   **FR-AI-003 (P1/FUTURE GATE):** Never invent measurements, sources, activities or
    outcomes.
-   **FR-AI-004 (P1/FUTURE GATE):** Do not diagnose, prescribe treatment or make
    emergency-triage claims under the general wellness scope.
-   **FR-AI-005 (P1/FUTURE GATE):** If inputs are missing, stale, contradictory or
    insufficient, state the limitation or withhold the dependent claim.
-   **FR-AI-006 (P1/FUTURE GATE):** Preserve input references and generation
    configuration/version metadata needed for quality investigation,
    subject to minimization.
-   **FR-AI-007 (P1/FUTURE GATE):** Validate output schema, person/account association,
    allowed content and unsupported claims before display.
-   **FR-AI-008 (P1/FUTURE GATE):** On AI failure, preserve access to records and
    deterministic analytics; show unavailable/retry state instead of
    fabricated fallback text.
-   **FR-AI-009 (P1/FUTURE GATE):** Phase 2 includes an interactive
    assistant that can answer questions about the user's own authorized
    health/activity data, ask relevant follow-up questions, and provide
    proactive insights when supported by available evidence. It must
    clearly distinguish source facts, deterministic calculations,
    interpretations and suggestions; it must not diagnose, prescribe,
    invent missing data or bypass permission boundaries.
-   **FR-AI-010 (P1/FUTURE GATE):** Apply appropriate rate, budget and abuse controls.
-   **FR-AI-011 (P1/FUTURE GATE):** Treat user/imported content as untrusted; prevent
    prompt injection from overriding authorization or safety controls.
-   **FR-AI-012 (P1/FUTURE GATE):** Label generated content so it cannot be confused with
    a measurement.

## 3.9 Predictive ML --- Phase 3

-   **FR-ML-001 (P1/FUTURE GATE):** Candidate use cases include activity
    trends, sleep patterns, personal baselines/deviations and
    goal-progress estimates.
-   **FR-ML-002:** Define each prediction target, intended
    interpretation, inputs, eligible population, data sufficiency rules,
    baseline, metrics and failure behavior before implementation.
-   **FR-ML-003:** Withhold predictions when documented data
    sufficiency/quality requirements are not met.
-   **FR-ML-004:** Compare each model with an appropriate
    transparent/statistical baseline.
-   **FR-ML-005:** Use leakage-safe evaluation and held-out data
    appropriate to the use case.
-   **FR-ML-006:** Only approved, versioned model artifacts may serve
    inference.
-   **FR-ML-007:** Separate training, evaluation, registry updates and
    production promotion.
-   **FR-ML-008:** Never deploy a model automatically solely because
    training finished.
-   **FR-ML-009:** Label outputs as estimates and communicate meaningful
    uncertainty/limitations.
-   **FR-ML-010:** Store model version, input window/reference and
    generation time.
-   **FR-ML-011:** Support disabling a use case and rolling back to a
    previous approved model.
-   **FR-ML-012:** Do not use private records for shared-model training
    without separate governance and consent.
-   **FR-ML-013:** Choose retraining cadence from evidence; daily
    retraining is not the default.
-   **FR-ML-014:** Monitor quality, input missingness and operational
    errors without exposing unnecessary personal data.

## 3.10 Automation, workers and notifications

Phase/priority note: workflow versioning, retry-safety, run records and security foundations apply to the phase in which the workflow is introduced. Phase 2 user-facing automation remains gated. Any requirement marked “phase-specific priority required” must have its release applicability recorded before implementation acceptance.

-   **FR-AUTO-001 (P0/P1 by phase):** Version-control and document
    workflows included in each release.
-   **FR-AUTO-002 (phase-specific priority required):** Sync, normalization and aggregation must be
    retry-safe and duplicate-safe.
-   **FR-AUTO-003 (Phase 2):** Support daily summaries, weekly reviews,
    approved reminders and eligible event-triggered insights.
-   **FR-AUTO-004 (phase-specific priority required):** Record run/correlation ID, status, timestamps,
    retry count and safe failure category.
-   **FR-AUTO-005 (phase-specific priority required):** Bound retries; distinguish transient errors from
    validation/authorization failures.
-   **FR-AUTO-006 (phase-specific priority required):** A failed workflow must not overwrite valid data or
    report false success.
-   **FR-AUTO-007 (phase-specific priority required):** Notifications must respect user preferences,
    permissions and platform limits.
-   **FR-AUTO-008 (phase-specific priority required):** Users can disable optional notifications without
    losing access to records.
-   **FR-AUTO-009 (phase-specific priority required):** Scheduled work must respect user timezone where
    relevant.
-   **FR-AUTO-010 (phase-specific priority required):** n8n may orchestrate workflows, but authenticated
    application services own authorization, validation, canonical writes
    and business rules.
-   **FR-AUTO-011 (phase-specific priority required):** Workflow credentials must be externalized and
    separated by environment.
-   **FR-AUTO-012 (phase-specific priority required):** Alert on repeated failures, queue buildup and
    exhausted retries where operationally available.
-   **FR-AUTO-013 (phase-specific priority required):** Describe background synchronization as best-effort
    when OS scheduling cannot guarantee immediate execution.
-   **FR-NOTIF-001:** Support preferences for notification categories
    included in the current phase.
-   **FR-NOTIF-002:** Distinguish scheduled, provider-accepted and
    delivered states only where evidence exists.
-   **FR-NOTIF-003:** Phase 2 may notify users about summaries, reviews,
    goals and eligible trends.
-   **FR-NOTIF-004:** Suppress optional notifications when disabled or
    when required permission is revoked.
-   **FR-NOTIF-005:** Avoid unnecessary sensitive health details in
    lock-screen previews.

## 3.11 Privacy controls and data lifecycle

-   **FR-PRIV-001 (P0):** Provide understandable permission/source
    controls where platform permits.
-   **FR-PRIV-002 (P0):** Allow source disconnection and explain its
    effects.
-   **FR-PRIV-003:** Disconnection stops future imports where possible
    and updates status; prior data follows the approved policy.
-   **FR-PRIV-004 (P0):** Provide user-initiated health-data export and
    account/data-deletion workflows by the first intended user-facing
    release. Before implementation is accepted, define and test export
    scope/format, deletion semantics, retention exceptions, derived-output
    and cache handling, queued/offline data handling, and backup expiry.
    Do not advertise a control until its actual behavior and limitations
    are implemented and verified.
-   **FR-PRIV-005:** Enforce account data isolation on APIs and
    background jobs.
-   **FR-PRIV-006:** Do not log raw health values, document contents,
    tokens, secrets or unnecessary identifiers.
-   **FR-PRIV-007:** Document data categories, purposes, sources,
    storage, processors, retention and access roles before production.
-   **FR-PRIV-008:** Do not collect data solely for speculative future
    model training.
-   **FR-PRIV-009:** Review AI provider retention/training terms before
    production health data is sent.
-   **FR-PRIV-010 (Phase 5):** Require explicit person-specific
    authorization for family features.
-   **FR-PRIV-011 (Phase 4):** Medical capabilities require additional
    privacy/safety review.

## 3.12 Future medical capability --- Phase 4

-   **FR-MED-001 (P2/FUTURE GATE):** Preserve source, person, time,
    units, correction and provenance context for future longitudinal
    medical records.
-   **FR-MED-002:** Support only explicitly selected document formats;
    expose extraction uncertainty and user review/correction where
    extraction is automated.
-   **FR-MED-003:** Distinguish extracted values from original document
    content and user-confirmed values.
-   **FR-MED-004:** Link summaries to underlying records/documents where
    appropriate.
-   **FR-MED-005:** Concerning-pattern detection requires defined
    intended use, validation, safety review and communication plan.
-   **FR-MED-006:** No medical feature may launch before intended-use
    definition, validation, appropriate clinical review, privacy/access
    review, regulatory assessment where applicable, and explicit
    approval.
-   **FR-MED-007:** Do not claim clinical verification unless a real
    verification process occurred.
-   **FR-MED-008:** An emergency-oriented card/summary may be considered
    later; it is not a Phase 1 requirement.

## 3.13 Future family management --- Phase 5

-   **FR-FAM-001 (P2):** Data model must distinguish account holder from
    person represented by a record.
-   **FR-FAM-002:** Family sharing remains disabled until an approved
    authorization model exists.
-   **FR-FAM-003:** Access grants must be person-scoped, action-scoped
    and revocable.
-   **FR-FAM-004:** Test cross-person isolation across APIs, jobs, AI
    context, exports, logs and admin tools.
-   **FR-FAM-005:** Rules for minors, guardians, caregiver roles,
    consent and revocation remain OPEN until Phase 5 discovery.

## 3.14 Administration and audit

-   **FR-OPS-001 (P0):** Protect administrative interfaces and
    operational endpoints with least privilege.
-   **FR-OPS-002:** Audit sensitive security, permission,
    export/deletion and admin actions as defined by policy.
-   **FR-OPS-003:** Audit events must not store full health payloads or
    secrets.
-   **FR-OPS-004:** Operational tools must not grant unrestricted record
    access by default.
-   **FR-OPS-005:** Support diagnostics should use redacted identifiers;
    exceptional sensitive access must be approved and auditable.

------------------------------------------------------------------------


## 3.15 Requirement phase, priority and acceptance rules

- **REQ-GOV-001:** Every normative requirement shall identify its applicable phase, priority (P0/P1/P2), and verification method. Where a requirement is intentionally phase-neutral, the reason and release applicability shall be stated.
- **REQ-GOV-002:** P0 means mandatory for the applicable Phase 0/Phase 1 gate as explicitly stated; it does not automatically make every future-phase capability part of Phase 1.
- **REQ-GOV-003:** Requirements for Phase 2–5 capabilities shall remain gated until the relevant phase's entry criteria, policy decisions, tests, and approvals are complete.
- **REQ-GOV-004:** A requirement marked “when included” or “where supported” shall reference an approved capability matrix or decision. Such wording must not be used to avoid deciding release scope.
- **REQ-GOV-005:** An open decision affecting a mandatory release capability blocks acceptance of that capability until resolved or covered by a documented, authorized exception.
- **REQ-GOV-006:** Acceptance criteria shall describe observable outcomes and pass/fail evidence. Qualitative terms such as “fast,” “secure,” or “accessible” alone are insufficient.

## 3.16 Phase 1 metric/source capability baseline

The Phase 1 metric/source list remains OPEN under OD-01 and OD-02. This is a required decision artifact, not a declaration that every candidate metric will ship.

| Field required for each proposed Phase 1 capability | Required content |
|---|---|
| Metric/category | Canonical metric ID, value type and unit |
| Source/pathway | HealthKit, Health Connect, manual entry, or another explicitly approved source |
| Platform coverage | Exact supported OS/device/version range after feasibility testing; otherwise OPEN |
| Access constraints | Permissions, source authorization, history/background limitations |
| Time/provenance | Event time, ingestion/sync time, timezone context, source identity |
| Quality policy | Valid ranges, invalid/implausible values, duplicate/conflict behavior |
| Failure/fallback | Denied/revoked/unavailable source, partial import, approved manual/alternate path |
| Verification | Test ID, representative environment, expected result and evidence |

No capability shall be represented as supported until its pathway has been demonstrated on the approved platform matrix. OD-04 must separately decide which manual-entry categories, edits, deletions, and correction semantics are in Phase 1.


# 4. External interface requirements

## 4.1 Web and mobile clients

-   **IF-CLIENT-001:** Web uses Next.js/React/TypeScript/Tailwind and
    calls the web API; it never connects directly to PostgreSQL.
-   **IF-CLIENT-002:** Mobile uses React Native/Expo with native
    configuration as required and calls the mobile API.
-   **IF-CLIENT-003:** Clients must provide loading, empty, stale,
    offline/network-failure, unauthorized and recoverable error states.
-   **IF-CLIENT-004:** Clients must not contain long-lived service
    secrets or direct AI-provider credentials.
-   **IF-CLIENT-005:** Mobile must distinguish local/pending writes from
    server-confirmed synchronization.
-   **IF-CLIENT-006:** Platform-specific differences must be documented;
    unsupported capabilities degrade gracefully.

## 4.2 Health platform interfaces

-   **IF-HEALTH-001:** HealthKit and Health Connect adapters isolate
    platform-specific structures from the canonical model.
-   **IF-HEALTH-002:** Request only permissions required for selected
    data categories.
-   **IF-HEALTH-003:** Handle denied/revoked permissions, unavailable
    APIs, unsupported types, missing history and partial results.
-   **IF-HEALTH-004:** Map units/timestamps correctly and preserve
    source attribution.
-   **IF-HEALTH-005:** Test on representative supported iOS and Android
    environments before Phase 1 release.

## 4.3 API contracts

-   **IF-API-001:** APIs must be versioned and documented with explicit
    request/response schemas.
-   **IF-API-002:** FastAPI/OpenAPI should be used to generate or verify
    client contracts where feasible.
-   **IF-API-003:** Errors must use stable machine-readable codes and
    safe user messages.
-   **IF-API-004:** Validate input and enforce authorization
    server-side.
-   **IF-API-005:** Paginate unbounded history/list results.
-   **IF-API-006:** Retriable writes must support idempotency or
    equivalent duplicate protection.
-   **IF-API-007:** Never return stack traces, secrets or sensitive
    diagnostics to clients.
-   **IF-API-008:** Health responses must include sufficient
    source/time/unit context.
-   **IF-API-009:** Responses must not imply freshness without evidence.
-   **IF-API-010:** Test authorization across both client APIs and
    delegated services.

## 4.4 AI and automation interfaces

-   **IF-AI-001:** Isolate provider SDKs behind an adapter.
-   **IF-AI-002:** Store provider credentials server-side.
-   **IF-AI-003:** Send only approved minimum context.
-   **IF-AI-004:** Handle timeout, rate limit, invalid output and
    provider outage without blocking canonical records.
-   **IF-AI-005:** Review provider retention/training practices before
    production use.
-   **IF-AUTO-001:** Version workflow/event contracts.
-   **IF-AUTO-002:** Events carry stable IDs, type/version, timestamps
    and correlation IDs without unnecessary sensitive payloads.
-   **IF-AUTO-003:** Consumers must be idempotent or duplicate-safe.
-   **IF-AUTO-004:** n8n must use authenticated application interfaces
    for protected writes.
-   **IF-AUTO-005:** Keep credentials in the approved secret mechanism
    and separate by environment.

------------------------------------------------------------------------


## 4.5 Minimum API contract requirements

- **IF-API-011:** Each endpoint used by a release shall have a versioned contract identifying method/path, authentication, authorization scope, request schema, response schema, validation rules, and success/error responses. The contract may live in a versioned OpenAPI artifact referenced by this SRS.
- **IF-API-012:** Each error response shall include a stable machine-readable code and safe message; field-validation errors shall identify fields without exposing secrets, stack traces, or sensitive diagnostics.
- **IF-API-013:** List/history endpoints shall document pagination semantics, stable ordering, maximum page size, and filtering/sorting behavior where supported.
- **IF-API-014:** Every retriable write shall define idempotency-key scope/lifetime or equivalent duplicate prevention, including behavior when a key is reused with a different payload.
- **IF-API-015:** Concurrent update behavior shall be documented for mutable entities, including whether stale updates are rejected, merged, or explicitly resolved by the client.
- **IF-API-016:** API compatibility and deprecation rules shall be documented before a client contract is relied upon by a released web/mobile application.
- **IF-API-017:** Authentication/session design shall specify credential/token type, storage location, expiry, refresh/rotation, revocation, sign-out invalidation, recovery, and applicable CSRF protections. The exact mechanism remains OPEN under OD-18 until approved.
- **IF-API-018:** Authorization tests shall cover direct-object-reference changes, cross-account access, background jobs, exports, and both client-facing API boundaries.

## 4.6 Asynchronous event and workflow delivery

- **IF-AUTO-006:** Each event contract shall define event identity, schema version, creation time, correlation ID, producer, consumer, and minimum required payload.
- **IF-AUTO-007:** Event consumers shall be duplicate-safe. Where ordering is required, the contract shall state the ordering key and guarantee; otherwise consumers shall not assume global ordering.
- **IF-AUTO-008:** Each asynchronous workflow shall define retryable versus permanent failures, retry/backoff bounds, expiry/cancellation behavior, exhausted-retry handling, and reconciliation/alerting.
- **IF-AUTO-009:** Protected canonical writes shall be performed by authenticated application services, not by untrusted workflow payloads or direct public database access.
- **IF-AUTO-010:** Webhook endpoints and workflow credentials shall be authenticated, environment-separated, rotatable, and tested against unauthorized invocation. Event payloads shall minimize health data.


# 5. Data requirements

## 5.1 Data architecture principles

PostgreSQL is the authoritative store for synchronized canonical
records. The mobile database supports offline viewing and queued
operations; it is not a competing central authority. Source records,
normalized records, user corrections, deterministic aggregates, AI
insights and ML predictions must remain distinguishable.
Retention/deletion must follow an approved policy. The data model must
preserve future person-specific boundaries.

## 5.2 Logical entities

These are conceptual entities, not a frozen physical schema.

  -----------------------------------------------------------------------
  Entity                              Required purpose/fields
  ----------------------------------- -----------------------------------
  UserAccount                         Stable ID, identity links, account
                                      status, timestamps and minimal
                                      preferences.

  Person                              Stable person ID, account
                                      relationship, minimal profile data
                                      and future authorization boundary.

  IdentityLink/Session                Provider subject, link state and
                                      session metadata; never plaintext
                                      secrets.

  ConsentAndPermissionState           Source/category, known state and
                                      relevant timestamps/policy version.

  HealthSourceConnection              Person/source, connection status,
                                      last attempt/success, safe error
                                      and retry metadata.

  SourceRecord/IngestionReceipt       Source IDs, person, source time,
                                      ingestion time, idempotency key,
                                      import state and policy-approved
                                      payload/provenance.

  HealthRecord                        Stable ID, person, metric ID,
                                      value/unit, event time, source
                                      reference, origin,
                                      validation/correction state.

  MetricDefinition                    Canonical ID, value type, units,
                                      validation, time semantics and
                                      display rules.

  Goal                                Person, category, target/unit,
                                      period, status and timestamps.

  DerivedMetric/Aggregate             Person, metric, value/unit, time
                                      range, calculation version, input
                                      lineage and quality state.

  AIInsight                           Person, content/type, input
                                      references, provider/model/template
                                      version, generation time and
                                      validation state.

  ModelPrediction                     Person, use case,
                                      estimate/uncertainty, model
                                      version, input window, generation
                                      time and readiness state.

  NotificationPreference/Event        Category/channel/schedule, user
                                      preference, state and timestamps.

  WorkflowRun/OutboxEvent             Stable run/event ID, version,
                                      correlation, status, retry count
                                      and safe failure category.

  AuditEvent                          Actor, action, target reference,
                                      timestamp, result and redacted
                                      metadata.

  Future entities                     MedicalDocument,
                                      ExtractedMedicalValue,
                                      FamilyAccessGrant, CaregiverRole
                                      and PersonConsent after their
                                      policies are approved.
  -----------------------------------------------------------------------

## 5.3 Data integrity

-   **DATA-001:** Use stable IDs independent of mutable display values.
-   **DATA-002:** Define a consistent UTC/timezone convention and
    preserve source timezone context where needed.
-   **DATA-003:** Store units explicitly and test deterministic
    conversions.
-   **DATA-004:** Use database constraints to prevent invalid
    relationships/orphaned records where applicable.
-   **DATA-005:** Version, review and test migrations; document
    production application and rollback strategy.
-   **DATA-006:** Server-side validation is mandatory even when clients
    validate.
-   **DATA-007:** Use transactions when related changes must
    succeed/fail together.
-   **DATA-008:** Preserve enough lineage to explain derived outputs.
-   **DATA-009:** Propagate correction/deletion to derived outputs,
    caches, queues and backups according to approved policy.
-   **DATA-010:** Both APIs must use shared domain rules rather than
    conflicting independent writes.

## 5.4 Offline synchronization

-   **SYNC-001 (P0):** Show previously synchronized records offline,
    subject to local security/retention rules.
-   **SYNC-002:** Persist supported offline writes in a durable queue.
-   **SYNC-003:** Every queued operation has stable operation/entity
    IDs, type, creation time and retry state.
-   **SYNC-004:** Use idempotency keys or equivalent duplicate
    protection.
-   **SYNC-005:** Distinguish pending, in-progress, synchronized,
    retryable failure and requires-action states.
-   **SYNC-006:** Use bounded backoff; do not retry permanent
    validation/auth failures indefinitely.
-   **SYNC-007:** Define conflict policy per write type; do not blindly
    apply last-write-wins to meaningful corrections/provenance.
-   **SYNC-008:** Server responses identify accepted/rejected operations
    sufficiently for reconciliation.
-   **SYNC-009:** Sign-out/account switching/deletion must prevent
    cross-account exposure and handle queued work under approved policy.
-   **SYNC-010:** Local persistence must be distinguishable from
    server-confirmed sync.
-   **SYNC-011:** Recover after termination, restart, network loss and
    server outage without silent queue loss.
-   **SYNC-012:** Background timing is best-effort, not guaranteed
    real-time.
-   **SYNC-013:** Provide safe sync diagnostics where useful.
-   **SYNC-014:** Test duplicate delivery, partial batch success,
    retries, conflicts, account switching and offline recovery.

------------------------------------------------------------------------



### Merged detailed per-write-type synchronization requirements

The following requirements supplement SYNC-001 through SYNC-014. They add testable details from the companion v1.1.0 review draft and do not replace existing synchronization rules.

- **SYNC-015 (Phase 1, P0):** Every queued operation shall be bound to the account/person scope and schema version under which it was created. Account switching shall not rebind old operations to the new account. Verification: offline account-switch test.
- **SYNC-016 (Phase 1, P0):** Source-imported immutable records shall deduplicate using a source record ID when available; otherwise, the implementation shall use a documented deterministic key. Conflicting source payloads shall be surfaced or quarantined rather than silently overwritten. Verification: duplicate/conflicting source-fixture tests.
- **SYNC-017 (Phase 1, P0):** Concurrent updates to user-created records, goals and preferences shall follow a documented version/conflict policy. Stale updates shall be merged only where explicitly safe or rejected with a recoverable conflict response. Verification: concurrent-write tests.
- **SYNC-018 (Phase 1, P0):** Corrections to imported records shall preserve the original source value and correction history. Conflicting concurrent corrections shall not use silent last-write-wins. Verification: correction and concurrency tests.
- **SYNC-019 (Phase 1, P0):** Delete requests shall have stable idempotency identifiers and shall block, cancel or reconcile pending writes for the deleted scope according to the approved lifecycle policy. Verification: deletion with pending-queue tests.
- **SYNC-020 (Phase 1, P0):** The synchronization contract shall specify ordering guarantees (or explicitly state none), retry/backoff bounds, operation expiry, partial batch success, permanent-failure/dead-letter behavior and reconciliation. Values not approved remain TBD and block the affected release gate. Verification: queue-state transition and failure-injection tests.

## 5.5 Data lifecycle contract

- **DATA-011:** Before export/deletion is accepted for release, an approved lifecycle specification shall define affected data classes across canonical records, source receipts, corrections, aggregates, AI/ML outputs, indexes if any, caches, logs, analytics, local databases, pending queues, third-party processors, replicas and backups.
- **DATA-012:** Export requirements shall define included/excluded data classes, format, completeness, timestamps, units, provenance, authorization, delivery security, generated-export expiry, and partial-failure behavior.
- **DATA-013:** Deletion requirements shall distinguish immediate user-access revocation, deletion from active stores, derived-output invalidation, local-device cleanup, third-party deletion requests, and eventual backup expiry. The product shall not claim immediate or complete erasure unless evidence supports that claim.
- **DATA-014:** Sign-out, account switching, source disconnection, and account deletion shall each have distinct documented effects on local cached data and pending offline operations.
- **DATA-015:** If an operation cannot be completed synchronously, the system shall expose truthful status, failure/retry path, and completion criterion. Status shall distinguish requested, in progress, completed, failed, and partially completed where applicable.
- **DATA-016:** Retention periods, backup expiry, export format, and deletion exceptions remain OPEN under OD-07/OD-14. This SRS does not invent values.



### Merged detailed export/deletion acceptance requirements

These requirements supplement DATA-011 through DATA-016 and PRV-001 through PRV-011. They specify observable workflow behavior; they do not approve retention durations, deletion exceptions or export formats.

- **PRV-012 (Phase 1, P0):** Export jobs shall expose accurate requested, in-progress, completed, partially failed, failed and requires-action status where applicable. Package contents shall identify included categories, generation time, event timestamps, units, provenance and exclusions. Exact export format remains OPEN (OD-14). Verification: export reconciliation and UX tests.
- **PRV-013 (Phase 1, P0):** Deletion completion shall be asserted only for stores and lifecycle steps supported by evidence. Approved exceptions and backup-expiry delays shall be communicated accurately. Verification: deletion store-inventory review, lifecycle tests and UX acceptance.
- **PRV-014 (Phase 1, P0):** Sign-out, account switching and deletion shall prevent old-account queued operations from being submitted under another identity. Local data/queue cleanup or blocking shall follow the approved lifecycle policy. Verification: offline device tests.
- **PRV-015 (Phase 1, P0):** Backups/restores shall reconcile approved deletion records before restored user data is made available. Retention/expiry durations remain OPEN under OD-07/OD-20. Verification: restore drill with deletion reconciliation.
- **PRV-016 (Phase 1, P0):** Export/deletion audit evidence shall record only the minimum workflow metadata needed to demonstrate status/outcome and shall not retain full health payloads or export contents. Verification: audit schema and log-redaction tests.

# 6. Architecture and repository requirements

## 6.1 Component responsibilities

-   **Web app:** presentation, browser UX and web-specific state; uses
    web API.
-   **Mobile app:** presentation, permissions, native health adapters,
    local DB, sync queue and platform background behavior; uses mobile
    API.
-   **Web API:** web-facing orchestration and request/response
    validation.
-   **Mobile API:** mobile-facing orchestration and sync endpoints.
-   **Identity:** shared account/identity/authorization primitives.
-   **Health data:** canonical records, ingestion, validation,
    provenance, dedupe, correction and lifecycle.
-   **Analytics:** deterministic aggregations, trends and goals.
-   **AI:** Phase 2 context construction, provider adapter, validation
    and output provenance.
-   **ML training/evaluation:** offline experiments, baseline
    comparison, evaluation and packaging.
-   **ML inference:** approved models only; no online training or
    promotion.
-   **Notifications:** preference evaluation, scheduling and delivery
    state.
-   **Workers/automation:** background/event work and retries; protected
    writes go through application interfaces.

## 6.2 Architecture requirements

-   **ARCH-001:** Web and mobile are independent applications.
-   **ARCH-002:** Web-facing and mobile-facing APIs are separate
    boundaries.
-   **ARCH-003:** Shared identity and health-data rules are reused, not
    duplicated.
-   **ARCH-004:** PostgreSQL is the canonical synchronized source of
    truth.
-   **ARCH-005:** Mobile local storage is an offline cache/queue, not a
    second central authority.
-   **ARCH-006:** Logical boundaries do not require every folder to be a
    separate process/container.
-   **ARCH-007:** Inter-component contracts are documented; direct
    cross-component table access is discouraged and documented if used.
-   **ARCH-008:** Suitable long-running work runs in workers, not
    request handlers.
-   **ARCH-009:** AI/ML providers are isolated behind adapters.
-   **ARCH-010:** Preserve provenance and person boundaries for future
    medical/family features.
-   **ARCH-011:** Significant choices are recorded as architecture
    decision records (ADRs).
-   **ARCH-012:** Co-deployment is allowed if interfaces, security,
    ownership and tests remain explicit.

## 6.3 Technology decisions

  -----------------------------------------------------------------------
  Area                    Confirmed direction     Still to decide
  ----------------------- ----------------------- -----------------------
  Web                     Next.js, React,         UI/state/query
                          TypeScript, Tailwind    libraries

  Mobile                  React Native + Expo     Exact local DB,
                                                  encryption/key storage,
                                                  native integration
                                                  libraries

  Backend                 FastAPI/Python          Auth library,
                                                  inter-service
                                                  transport, packaging

  Database                PostgreSQL              Hosting, sizing,
                                                  pooling, backup plan

  Migrations              Versioned migrations    Exact tool; Alembic is
                                                  a candidate

  ML                      Python, Pandas, NumPy,  Registry/experiment
                          scikit-learn            tracking

  Automation              n8n where viable        n8n vs
                                                  application-worker
                                                  split and hosting

  Deployment              Free-tier-first         Providers, cost
                                                  thresholds and
                                                  distribution costs
  -----------------------------------------------------------------------

## 6.4 Target repository structure

``` text
vitalsense/
├── apps/
│   ├── web/                         # Next.js, React, TypeScript, Tailwind
│   │   ├── public/
│   │   ├── src/{app,components,features,hooks,lib,types,config}/
│   │   ├── tests/
│   │   └── .env.example
│   └── mobile/                      # React Native + Expo
│       ├── app/
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── platform/{ios,android}/
│       │   ├── permissions/
│       │   ├── local-db/{schema,migrations,repositories}/
│       │   ├── sync/{queue,engine,conflict-resolution,retry}/
│       │   ├── background/
│       │   ├── notifications/
│       │   ├── api/
│       │   └── config/
│       └── tests/
├── services/
│   ├── web-api/
│   ├── mobile-api/
│   ├── identity-service/
│   ├── health-data-service/
│   ├── analytics-service/
│   ├── ai-service/
│   ├── ml-inference-service/
│   ├── notification-service/
│   └── worker-service/
├── ml/
│   ├── training/{data/{raw,interim,processed,external},notebooks,src,configs,scripts,reports,tests}/
│   ├── inference/{model_loader,input_validation,feature_pipeline,predictors,output_validation,tests}/
│   ├── model_registry/
│   └── evaluation/
├── automation/
│   ├── n8n/workflows/
│   ├── schedules/
│   ├── event-contracts/
│   └── runbooks/
├── packages/{api-contracts,shared-types,python-common,design-system}/
├── database/
│   ├── postgres/{migrations,schemas,indexes,seed,tests}/
│   ├── local-mobile/{schema,migrations}/
│   ├── fixtures/
│   └── diagrams/
├── infrastructure/{docker,deployment,ci-cd,monitoring,logging,backups,scripts}/
├── tests/{contract,integration,e2e,cross-platform,offline-sync,security,privacy,performance,accessibility,ml-safety}/
├── docs/{product,architecture,api,database,security,privacy,testing,deployment,operations,research}/
├── scripts/
├── prompts/                          # Antigravity prompts, not full conversations
├── .github/
├── .gitignore
├── .env.example
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
├── package.json
├── pnpm-workspace.yaml
├── pyproject.toml
└── Makefile
```

Repository rules:

- **REPO-001:** Training and online inference remain separate.
- **REPO-002:** Never commit private health data, production exports, credentials or secrets.
- **REPO-003:** `.gitignore` covers environment files, local databases containing personal data, datasets, generated artifacts, logs, caches and build outputs.
- **REPO-004:** Store Antigravity prompts individually in `prompts/`; do not copy entire conversations by default.
- **REPO-005:** Major components document setup, configuration, run and test instructions.
- **REPO-006:** API contract generation/drift checks should be reproducible in CI.
- **REPO-007:** The tree is logical; co-deployment is acceptable if responsibilities and controls remain explicit.

------------------------------------------------------------------------


## 6.5 Deployment topology and service boundaries

The repository tree in Section 6.4 is a logical organization, not a commitment to deploy each folder as a separate service.

- **ARCH-013:** Before Phase 1 deployment design is frozen, an ADR shall identify which components are co-deployed, separately deployed, or run as scheduled/background workers; the decision shall include operational cost, security boundaries, failure isolation, deployment complexity, and test implications.
- **ARCH-014:** Web-facing and mobile-facing APIs may share a deployment and domain implementation, but shall retain documented client-facing contracts and authorization behavior.
- **ARCH-015:** n8n is an orchestrator, not the authority for canonical data validation, authorization, or business policy. OD-22 shall define which jobs belong in n8n versus application-owned workers before production automation is enabled.
- **ARCH-016:** The system shall document event/outbox persistence and delivery semantics if reliable asynchronous delivery is required. If no durable outbox is selected, the design shall document accepted loss/duplication risk and recovery approach.


# 7. Security and privacy requirements

## 7.1 Security

-   **SEC-001:** All private API operations require authentication.
-   **SEC-002:** Enforce authorization for every record, aggregate,
    insight, prediction, export and background task.
-   **SEC-003:** Apply least privilege to users, operators, service
    accounts, database roles and workflow credentials.
-   **SEC-004:** Cross-account access tests must prove that changing
    IDs/parameters cannot expose another user's records.
-   **SEC-005:** Future person grants are checked in all request and job
    paths.
-   **SEC-006:** Encrypt network traffic in deployed environments.
-   **SEC-007:** Protect central data at rest using documented
    hosting/database controls.
-   **SEC-008:** Protect sensitive mobile-local data with an approved
    encryption/key strategy.
-   **SEC-009:** Keep secrets in approved environment/secret management,
    never source control or client bundles.
-   **SEC-010:** Validate inputs and apply rate/abuse controls
    appropriate to auth, ingestion, AI, export and admin endpoints.
-   **SEC-011:** Configure CORS, secure headers, session and CSRF
    protections where applicable.
-   **SEC-012:** Use parameterized queries/ORM protections against
    injection.
-   **SEC-013:** Treat imported text and user content as untrusted,
    especially in AI/workflows.
-   **SEC-014:** Audit sensitive security and lifecycle events with
    redacted metadata.
-   **SEC-015:** Define incident triage, credential rotation,
    revocation, recovery and user communication before production.
-   **SEC-016:** Dependency/container scanning should run in CI;
    critical findings must be addressed or formally accepted before
    production.

## 7.2 Privacy and lifecycle

-   **PRV-001:** Collect only data needed for a disclosed, authorized
    function.
-   **PRV-002:** Do not collect unrelated health data for speculative
    training.
-   **PRV-003:** Document data categories, purposes, sources, storage,
    processors, access roles, retention and deletion.
-   **PRV-004:** Allow source disconnection and accurately explain its
    effect on new imports and existing records.
-   **PRV-005:** Export/deletion behavior must follow an approved policy
    before being advertised.
-   **PRV-006:** Policy must define effects on derived metrics, AI
    insights, predictions, caches, queues, analytics stores and backups.
-   **PRV-007:** Retention periods, export formats and deletion
    semantics remain OPEN; this SRS invents none.
-   **PRV-008:** Review AI provider retention/training practices and
    send minimum necessary context.
-   **PRV-009:** Family sharing stays off until explicit person-specific
    authorization is implemented.
-   **PRV-010:** Medical capabilities require additional privacy, safety
    and applicable regulatory review.
-   **PRV-011:** Logs, traces, analytics, crash reports and support
    diagnostics must not expose unnecessary health data or secrets.

Release gate: the team must explain what is collected, why, where it is
stored/processed, who can access it, how disconnect behaves, and how the
approved retention/export/deletion policy works.

------------------------------------------------------------------------

# 8. AI/ML lifecycle and safety

-   **AIML-001:** Deterministic logic is authoritative for arithmetic,
    unit conversion, aggregation, goal progress and validation.
-   **AIML-002:** AI generates explanations/summaries only from
    authorized context; it is not the source of numeric truth.
-   **AIML-003:** AI outputs must be schema-validated, safety-checked
    and linked to input/configuration metadata.
-   **AIML-004:** Test AI behavior for missing/stale/conflicting data,
    fabricated claims, prompt injection, account-context leakage,
    malformed output, rate limits and provider outage.
-   **AIML-005:** AI failure must preserve access to records and
    deterministic results.
-   **AIML-006:** Monitor AI latency, error rate, usage/cost and safety
    failures without retaining unnecessary prompt content.
-   **AIML-007:** Each model has a defined use case, dataset provenance,
    code/configuration version, artifact version, evaluation report and
    approval record.
-   **AIML-008:** Evaluation must prevent data leakage appropriate to
    the use case, including person/time leakage where relevant.
-   **AIML-009:** Compare model results against a suitable baseline.
-   **AIML-010:** Use suitable error measures and slice analysis where
    enough data exists.
-   **AIML-011:** Forecast readiness criteria must be evidence-based; no
    unsupported numeric threshold is invented here.
-   **AIML-012:** Predictions communicate uncertainty/limitations and
    can be withheld when data is insufficient.
-   **AIML-013:** Production promotion requires explicit approval.
-   **AIML-014:** Support disabling a use case and rolling back to a
    prior approved model.
-   **AIML-015:** Online inference must not train/promote models during
    user requests.
-   **AIML-016:** Shared training on private user data requires separate
    governance, disclosure and consent.

------------------------------------------------------------------------

# 9. Non-functional requirements

Numeric targets are not fabricated in this draft. They must be set using
representative-device testing, expected-load modeling and product-owner
approval. The behaviors below remain required.

## 9.1 Performance

-   **NFR-PERF-001:** Show loading feedback for operations that do not
    complete immediately.
-   **NFR-PERF-002:** Bound and paginate history/list responses.
-   **NFR-PERF-003:** Run suitable long-running AI/ML/report jobs
    asynchronously.
-   **NFR-PERF-004:** Avoid unnecessary repeated full-history scans.
-   **NFR-PERF-005:** Measure API latency, initial render, sync
    throughput and job duration before production.
-   **NFR-PERF-006:** Mobile tracking/background work must consider
    battery, CPU, memory, network and OS limits.

## 9.2 Reliability and recovery

-   **NFR-REL-001:** Temporary network/provider/database/workflow
    failures produce explicit recoverable states where possible.
-   **NFR-REL-002:** Retries are bounded, observable and idempotent.
-   **NFR-REL-003:** Downstream AI/ML/notification failures do not erase
    committed canonical records.
-   **NFR-REL-004:** Migrations and deployments have documented recovery
    procedures.
-   **NFR-REL-005:** Define backup RPO/RTO before production; values
    remain OPEN.
-   **NFR-REL-006:** Monitor APIs, database connectivity, sync failures,
    queue depth, job failures and relevant providers.

## 9.3 Maintainability and portability

-   **NFR-MAINT-001:** Explicit boundaries exist for web, mobile, APIs,
    domain logic, ML, inference and automation.
-   **NFR-MAINT-002:** Shared health-data rules are not duplicated
    inconsistently.
-   **NFR-MAINT-003:** Version interfaces/events where changes can break
    consumers.
-   **NFR-MAINT-004:** Externalize environment-specific configuration.
-   **NFR-MAINT-005:** Manage dependencies and lockfiles reproducibly.
-   **NFR-COMP-001:** Select and document supported browser, iOS and
    Android versions before release.
-   **NFR-COMP-002:** Test platform-specific capability differences.
-   **NFR-COMP-003:** Degrade gracefully when a capability is
    unavailable.

## 9.4 Accessibility and observability

-   **NFR-UX-001:** Core screens have semantic controls, accessible
    labels, visible focus and understandable errors.
-   **NFR-UX-002:** Do not use color alone to communicate status.
-   **NFR-UX-003:** Charts/text work across supported screen sizes and
    accessibility settings.
-   **NFR-UX-004:** Motion must not block access to core data or
    controls.
-   **NFR-OBS-001:** Use structured logs with correlation IDs and safe
    error categories.
-   **NFR-OBS-002:** Monitor success/failure, latency, retries, source
    freshness and AI/ML quality where applicable.
-   **NFR-OBS-003:** Observability must not collect unnecessary health
    data/secrets.
-   **NFR-OBS-004:** Distinguish data freshness from service health.

## 9.5 Cost

-   **NFR-COST-001:** Prefer free-tier-first, cost-conscious services
    where feasible.
-   **NFR-COST-002:** Document usage/limit assumptions for AI,
    databases, storage, workers, monitoring and distribution.
-   **NFR-COST-003:** Add usage quotas/budget alerts for cost-sensitive
    AI/background processing where available.
-   **NFR-COST-004:** Do not promise production hosting, AI, app-store
    distribution or third-party integrations are free without verifying
    terms and limits.

------------------------------------------------------------------------


## 9.6 Measurable quality targets and release-gate register

The following are mandatory target-setting categories. **TBD means no approved value was present in the source SRS; it is not a passing target.** Product/engineering/QA must approve values and test conditions before the affected production gate.

| Area | Required target/decision | Measurement and evidence required | Owner / gate |
|---|---|---|---|
| API latency/error rate | TBD — approved percentile thresholds and error budget | Repeatable load test; request mix, concurrency, deployment profile and result | Engineering + product owner; Phase 1 |
| Initial render/core screen performance | TBD — supported device/network profile and threshold | Instrumented web/mobile test on representative supported devices | Engineering + product owner; Phase 1 |
| Sync latency/recovery | TBD — foreground sync and offline-recovery criteria | Dataset size, interrupted network, restart, duplicate delivery and queue recovery evidence | Mobile/backend + QA; Phase 1 |
| Reliability/availability | TBD — service objective and measurement window | Monitoring definition and observed test/staging evidence | Engineering + product owner; before production |
| Backup recovery | OD-20 RPO/RTO values TBD | Restore drill, measured recovery time/data loss, evidence record | Engineering + product owner; before production |
| Compatibility | OD-16 supported browser/iOS/Android matrix TBD | Passing test matrix for each declared supported version/device class | Engineering + product owner; Phase 1 |
| Accessibility | TBD — conformance target and applicable test method | Automated checks plus manual keyboard/screen-reader review on core journeys | Design/engineering + QA; Phase 1 |
| Security findings | TBD — severity threshold, exception approver and expiry | Dependency/container/security test report and remediation/exception records | Security/engineering; before production |
| Background jobs/events | TBD — retry, queue-age, failure-alert thresholds | Failure injection, retry exhaustion, duplicate handling, reconciliation and alert evidence | Backend/operations; applicable phase |
| Observability/privacy | Required signals and redaction rules; numeric alert thresholds TBD | Dashboard/alert review and log/trace inspection for prohibited sensitive fields | Operations/privacy reviewer; before production |

- **NFR-AC-001:** Each TBD target above shall be resolved with an owner, approver role, rationale, test conditions, evidence artifact, and release gate. A proposal may be recorded but must not be labeled approved without approval evidence.
- **NFR-AC-002:** Phase 1 shall not be declared production-ready while a mandatory Phase 1 target is unresolved, unless an authorized exception records risk, compensating controls, expiry/review date, and approving role.
- **NFR-AC-003:** Performance results shall state environment, build/version, data volume, device/network profile, measurement method, and test date so results are reproducible.
- **NFR-AC-004:** Security exceptions shall identify severity, affected asset, mitigation, owner, expiry date and approver.
- **NFR-AC-005:** Accessibility acceptance shall include manual verification of core journeys; automated scans alone are insufficient evidence.



### Merged measurable-target approval and exception requirements

These requirements supplement the NFR target register. They do not create numeric targets; approval evidence remains mandatory.

- **NFR-REL-007 (Phase 0/1, P0):** Every mandatory release-critical NFR shall have a measurable approved target or a documented, time-bounded exception before the applicable release gate can pass. Verification: release checklist and decision-register review.
- **NFR-REL-008 (Phase 0/1, P0):** Performance/reliability test evidence shall record software/configuration version, environment, workload/device profile, method, results and limitations. Verification: evidence-artifact review.
- **NFR-REL-009 (Phase 0/1, P0):** Any exception to a mandatory target shall name approver role, rationale, compensating controls, expiry and affected scope; expired exceptions block release. Verification: exception-register gate test.
- **NFR-REL-010 (Phase 0/1, P0):** Backup recovery verification shall include deletion/retention reconciliation, not only successful database restoration. Verification: documented restore drill.

# 10. Testing and verification

## 10.1 Required test layers

1.  **Unit:** unit conversions, validation, aggregation, goals,
    provenance, dedupe, authorization helpers, sync state, retry rules,
    AI validation and ML utilities.
2.  **Integration:** FastAPI/database, auth across APIs, source
    adapters, migrations, event delivery, worker idempotency, AI adapter
    failures and approved inference loading.
3.  **End-to-end:** onboarding; denied/partial permissions; empty
    dashboard; source import/status/history; approved manual entry;
    goals; source disconnect; offline recovery; Phase 2 AI failure;
    Phase 3 insufficient-data forecast.
4.  **Cross-platform:** representative iOS/Android versions, permission
    changes, platform data availability, background limits, local
    storage and account switching.
5.  **Security/privacy:** cross-account access, expired sessions,
    injection/validation, secret leakage, sensitive logging, approved
    export/deletion, future family isolation.
6.  **Offline sync:** termination with queued writes, network
    loss/recovery, duplicate/reordered delivery, partial batch success,
    retry exhaustion, conflict rules, account switching.
7.  **ML safety:** baseline comparison, leakage checks, sufficiency
    rules, missing inputs, artifact compatibility, output bounds,
    monitoring and rollback.
8.  **Accessibility/performance:** keyboard/screen reader, contrast,
    small screens, API load, mobile resource use and slow/unavailable
    services.

Test data must be synthetic or appropriately de-identified. Production
health data must not be copied into routine development/test
environments without a documented approved exception.

## 10.2 Verification evidence

Every P0 requirement must map to a test ID, manual test, review
checklist, ADR or release-gate artifact. Code existence alone is not
proof of completion.

## 10.3 Core acceptance journeys

-   **No permissions:** onboarding completes; empty states appear; no
    fabricated zero values; user can connect later.
-   **Partial permission:** only authorized categories import; denied
    categories remain unavailable; permitted features still work.
-   **Successful import:** records have correct
    source/person/time/unit/provenance; duplicate attempts do not
    duplicate records; sync status is accurate.
-   **Offline use:** prior records remain available under local policy;
    writes queue durably; pending differs from server-confirmed; sync
    resumes without silent loss.
-   **AI failure:** underlying records/calculations remain available;
    failure is explicit; no fabricated fallback is shown.
-   **Insufficient ML data:** prediction is withheld and the reason is
    explained without inventing thresholds.
-   **Disconnect source:** new imports stop where possible; status
    updates; old records follow approved policy and are not falsely
    claimed deleted.
-   **Export/delete account data:** the user can initiate the approved
    workflow, receives an accurate status, and the implementation follows
    documented handling for canonical records, derived outputs, queued
    operations, caches and backup expiry without claiming immediate
    erasure where it cannot be guaranteed.

------------------------------------------------------------------------


## 10.4 Requirement-level verification standard

Every requirement shall be linked to a verification record before its applicable release. The record shall identify requirement ID; phase/priority; test or review ID; verification type; preconditions; test data/environment; method; expected result; pass/fail rule; evidence location; and defect/exception reference if applicable.

- **TEST-001:** A requirement is not verified solely because code, a screen, mock, or endpoint exists.
- **TEST-002:** P0, P1 and P2 requirements shall be verified before the release in which each requirement applies. Future-phase requirements may be marked “not yet due,” but must not be represented as passed.
- **TEST-003:** Negative-path testing shall cover denied/revoked permissions, unavailable sources, stale/partial data, invalid values, authorization failures, provider timeouts, malformed outputs, and retry exhaustion where relevant.
- **TEST-004:** Metric and aggregation tests shall cover timezone/daylight-saving boundaries, partial days, late-arriving data, corrections, recalculation, unit conversion and source conflicts where applicable.
- **TEST-005:** Sync/event tests shall cover duplicate and reordered delivery, concurrent writes, partial batch success, app termination, restart, account switching, permanent failures and reconciliation.
- **TEST-006:** Privacy lifecycle tests shall cover export completeness, access control, generated-export expiry, deletion propagation, local cleanup, queued operations, third-party requests and backup restoration according to approved policy.
- **TEST-007:** Each test result shall retain sufficient evidence for review without copying unnecessary real health data into test artifacts.
- **TEST-008:** Missing PRD links or test definitions shall be explicitly marked unresolved rather than inferred.



### Merged verification scenarios

The following extend TEST-001 through TEST-008. These are planned scenarios, not evidence that tests have been executed.

- **TEST-009:** Verify deletion across canonical records, derived outputs, caches, queues, logs/analytics stores and backups. Expected: lifecycle inventory is covered; approved exceptions/delays are disclosed; no unsupported erasure claim is made.
- **TEST-010:** Verify backup restoration after a deletion request. Expected: deletion reconciliation runs before restored records are exposed, according to the approved policy.
- **TEST-011:** Verify API authorization, stable error envelope, pagination, idempotency, rate limits and contract compatibility. Expected: unauthorized operations fail safely, duplicate writes are harmless, and schemas/error codes match the versioned companion API contract.
- **TEST-012:** Verify third-party health/AI/notification provider outage and asynchronous job failure. Expected: canonical records remain available where designed, retries are bounded, safe failure state is visible, and monitoring/reconciliation evidence is generated.

# 11. Deployment and operations

-   **DEP-001:** Provide reproducible setup for web/mobile, APIs,
    PostgreSQL, migrations, ML tooling and in-scope automation.
-   **DEP-002:** Provide placeholder `.env.example` files and document
    required variables.
-   **DEP-003:** CI runs applicable lint/format/type/unit/build checks.
-   **DEP-004:** Apply migrations through a controlled process, not ad
    hoc production edits.
-   **DEP-005:** Version deployed code/config/model artifacts.
-   **DEP-006:** Separate environment secrets.
-   **DEP-007:** Document rollback/recovery for application and model
    changes.
-   **DEP-008:** Mobile releases use approved signing/distribution
    processes; potential fees are included in cost planning.
-   **DEP-009:** APIs/workers expose safe health/readiness signals.
-   **DEP-010:** Health checks reveal no secrets, health records or
    sensitive topology.
-   **DEP-011:** Define PostgreSQL backup and restore strategy; test
    restoration.
-   **DEP-012:** Align backup retention with approved data lifecycle
    rules.
-   **DEP-013:** Choose RPO/RTO before production; do not invent values
    in this SRS.
-   **DEP-014:** Define incident triage, credential rotation, recovery
    and user communications before production.

------------------------------------------------------------------------

# 12. API capability groups

Exact URL paths are implementation details and are not frozen here.

  -----------------------------------------------------------------------
  Group                               Required operations
  ----------------------------------- -----------------------------------
  Identity                            Registration/sign-in callbacks,
                                      session lifecycle, account profile,
                                      sign-out

  Sources/permissions                 List supported sources,
                                      connection/status, permission state
                                      where available, disconnect

  Health data                         Import/sync, query history, inspect
                                      source context, selected manual
                                      entry/correction

  Dashboard/analytics                 Aggregates, history series, goal
                                      progress

  Goals                               Create/read/update/deactivate
                                      selected goal categories

  AI insights (Phase 2)               Request/list/retrieve summaries,
                                      generation status and failure/retry
                                      state

  Predictions (Phase 3)               Retrieve eligible forecasts,
                                      metadata and unavailable/readiness
                                      reason

  Notifications                       Preferences, schedules and useful
                                      status

  Privacy controls                    Approved export/deletion workflows

  Operations/admin                    Restricted diagnostics, queue
                                      status, audit

  Medical (Phase 4)                   Approved document import/review,
                                      longitudinal records and summaries

  Family (Phase 5)                    Person/access grants, authorization
                                      and revocation
  -----------------------------------------------------------------------

Common API requirements: explicit schemas, stable error codes,
validation, server-side authorization, pagination, idempotent writes,
versioning, source/time/unit context, and no unsupported claims about
freshness.

------------------------------------------------------------------------

# 13. Traceability matrix

The following table is a high-level map only; it does not replace requirement-level traceability or test evidence.

  -------------------------------------------------------------------------------
  Area                      Requirement families    Verification
  ------------------------- ----------------------- -----------------------------
  Auth/isolation            FR-AUTH, SEC            Auth integration, session and
                                                    cross-account tests

  Onboarding/permissions    FR-ONB                  Grant/deny/partial/revoke UI
                                                    and integration tests

  Source integrations       FR-DATA, IF-HEALTH      Adapter contracts and
                                                    representative iOS/Android
                                                    tests

  Provenance/data quality   FR-QUAL, DATA           Validation, normalization,
                                                    dedupe/conflict tests

  Dashboard/history/goals   FR-UI, FR-MAN           Calculation tests and UI
                                                    E2E/empty/stale-state tests

  Offline sync              SYNC                    Queue recovery, idempotency,
                                                    conflict and account-switch
                                                    tests

  AI                        FR-AI, AIML             Grounding, missing-data,
                                                    injection, output-validation
                                                    and outage tests

  ML                        FR-ML, AIML             Baseline/evaluation/leakage
                                                    evidence, approval and
                                                    rollback tests

  Automation                FR-AUTO, FR-NOTIF       Retry/idempotency,
                                                    preference, timezone and
                                                    failure tests

  Privacy/security          FR-PRIV, PRV, SEC       Data-flow review,
                                                    permission/disconnect tests,
                                                    lifecycle and security tests

  Medical                   FR-MED                  Intended-use,
                                                    clinical/privacy/regulatory
                                                    gate evidence

  Family                    FR-FAM                  Cross-person isolation across
                                                    all data paths

  Operations                DEP, NFR-OBS            CI, monitoring, restore and
                                                    recovery evidence
  -------------------------------------------------------------------------------

------------------------------------------------------------------------


## 13.1 Traceability rules and coverage limitations

The matrix above is a family-level overview, not complete requirement-level evidence. The companion file `VitalSense_SRS_v1.1.1_Traceability_Matrix.csv` is the authoritative requirement-level matrix and contains detailed verification fields merged from both candidate inventories. Because the PRD v1.1 itself was not supplied with this revision, links from individual PRD statements to SRS requirements are marked **TBD — verify against source PRD** rather than invented. Test IDs in the companion matrix are verification-plan placeholders, not evidence that tests have run or passed.

For every requirement, the project shall maintain a trace from product goal/PRD item (when available) to SRS ID, verification ID, phase/release gate, and evidence. Requirements without an identified PRD source or a fully specified test remain open traceability work.

# 14. Open decisions register

These are not silently resolved by the SRS. The product owner owns
product direction; engineering supplies feasibility evidence; QA
supplies acceptance/test evidence; relevant privacy/clinical reviewers
advise on future phases.

  ---------------------------------------------------------------------------------------------
  ID                Decision                 Owner/contributors            Resolve by
  ----------------- ------------------------ ----------------------------- --------------------
  OD-01             Exact Phase 1 metric     Product owner + platform      Before Phase 1 scope
                    categories and source    engineering                   freeze
                    integrations                                           

  OD-02             Priority trade-offs if   Product owner, usability      Phase 0
                    all candidate metrics    evidence where feasible       
                    cannot fit                                             

  OD-03             Acceptance criteria for  Product owner + engineering   Before Phase 0
                    first deployable                                       acceptance
                    milestone                                              

  OD-04             Exact manual-entry       Product owner +               Before Phase 1 scope
                    categories/correction    design/engineering            freeze
                    behavior                                               

  OD-05             Phase 2 assistant UX,    Product owner +               Before Phase 2 scope
                    supported question      AI/privacy/cost input         freeze
                    types, proactive         
                    insight triggers and                                   
                    usage limits                                            

  OD-06             Medical document formats Product owner + engineering + Before Phase 4
                    and extraction approach  future reviewers              implementation

  OD-07             Retention, export,       Product owner +               Before
                    deletion, derived        engineering/privacy/legal as  promising/shipping
                    outputs, caches and      applicable                    those controls
                    backups                                                

  OD-08             Final name and brand     Product owner                 Before public
                    availability                                           branding

  OD-09             Monetization/long-term   Product owner                 Before pricing/cost
                    cost model                                             commitments

  OD-10             Success measures and     Product owner + analytics/QA  Definitions before
                    numeric targets                                        instrumentation;
                                                                           targets after
                                                                           baseline

  OD-11             Forecast readiness       Product owner + ML/QA         Before each Phase 3
                    thresholds per use case                                release

  OD-12             Medical intended use,    Product owner + appropriate   Before Phase 4
                    validation and approval  clinical/privacy/regulatory   release
                    roles                    expertise                     

  OD-13             Family roles, minors,    Product owner + privacy/legal Before Phase 5
                    consent and revocation   as applicable                 release

  OD-14             Export formats/sharing   Product owner +               Before relevant
                    pathways                 design/engineering            feature scope

  OD-15             Whether users need a     Product owner + usability     Before adding as
                    workflow history view    evidence                      committed scope

  OD-16             Minimum supported        Engineering + product owner   Before Phase 1
                    OS/browser versions                                    compatibility
                                                                           testing

  OD-17             Local DB/encryption/key  Mobile engineering/security   Before persisting
                    management                                             sensitive offline
                                                                           data

  OD-18             Auth/session             Backend/security              Before auth
                    implementation                                         implementation is
                                                                           accepted

  OD-19             Hosting and              Engineering + product owner   Before deployment
                    separate/co-deployed                                   design freeze
                    service choices                                        

  OD-20             Backup RPO/RTO           Product owner + engineering   Before production

  OD-21             AI provider, retention   Product owner + AI/privacy    Before production
                    terms and cost limits                                  health data goes to
                                                                           provider

  OD-22             n8n vs                   Backend/operations            Before production
                    application-worker split engineering                   automation
  ---------------------------------------------------------------------------------------------

------------------------------------------------------------------------


## 14.1 Decision control requirements

The OD-01–OD-22 table remains the source list of open decisions. The companion `VitalSense_SRS_v1.1.1_Open_Decision_Register.md` expands it with options/proposals, affected requirements, impact, and release gates. “Proposed” does not mean “approved.” Where the source SRS does not provide a decision owner by named individual, the accountable role is used. Decisions with no safe default remain open until the product owner and required technical/privacy reviewers approve them.


# 15. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Required response
  ----------------------------------- -----------------------------------
  Platform API differences            Feasibility proof, capability
                                      matrix, unavailable states and
                                      platform tests.

  Delayed background sync             Best-effort behavior, freshness
                                      indicators, retry and manual
                                      refresh where supported.

  Missing data mistaken for zero      Explicit missing states and tests.

  Duplicate/conflicting records       Idempotency, provenance and
                                      documented conflict rules.

  Offline data loss/duplication       Durable queue, stable IDs,
                                      idempotent API and recovery tests.

  AI hallucination/overconfidence     Grounding, validation, safety
                                      tests, limitations and fallback to
                                      canonical records.

  Unreliable forecasts                Baseline comparison, held-out
                                      evaluation, monitoring and
                                      rollback.

  Health data leakage                 Minimization, redaction, provider
                                      review and strict authorization.

  Medical features misunderstood      Separate intended-use and medical
                                      release gates.

  Family cross-person exposure        Default-deny sharing,
                                      person-specific authorization and
                                      end-to-end isolation tests.

  Free-tier changes                   Usage/cost monitoring, documented
                                      assumptions and provider isolation.

  Scope creep                         Phase matrix, decision register and
                                      explicit scope-change approval.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 16. Definition of done and release gates

**Gate rule:** “Approved targets” in this section means the target register in Section 9.6 has an approved value and verification method. An unresolved mandatory Phase 1 target or scope decision blocks production acceptance unless a documented exception is approved by the accountable role, with risk, compensating control, expiry/review date, and evidence. Future-phase requirements are assessed only at their own phase gate.

## Phase 0 --- foundation

-   Reproducible repository and environment setup.
-   Web/mobile/API skeletons build and run in the agreed environment.
-   Identity and canonical health-data boundaries documented.
-   PostgreSQL migrations and test database setup work.
-   Offline local-store/sync proof works with synthetic data.
-   Health-platform feasibility is proven on representative iOS/Android
    environments or limitations/fallback are documented.
-   CI runs; secrets and private health data are excluded from source
    control.
-   Architecture decisions and blockers are recorded.
-   Product owner accepts the Phase 0 checklist.

## Phase 1 --- personal tracking

-   Metric/source scope is frozen.
-   Granted/denied/partial/revoked permission behavior is correct.
-   Imported records preserve person/source/time/unit/provenance.
-   Missing/stale data is not presented as zero or real-time.
-   Dashboard/history/goals and approved manual entry work.
-   Offline viewing and queued writes recover correctly.
-   Auth and cross-account isolation tests pass.
-   Source disconnect behavior follows approved policy.
-   Privacy disclosures/data-flow documentation are reviewed.
-   Security, accessibility, performance and cross-platform tests meet
    approved targets.
-   Cost assumptions and monitoring are reviewed.
-   No unresolved P0 defect remains without documented acceptance.

## Phase 2 --- AI/automation

-   Provider data terms and cost controls approved.
-   Outputs grounded, validated, labeled and traceable.
-   Missing/stale/conflicting input, prompt injection and cross-account
    leakage tested.
-   AI failure preserves canonical data and deterministic analytics.
-   Workflow retries, idempotency, timezone and monitoring tested.
-   Notification preferences respected.

## Phase 3 --- ML

-   Target/use case and readiness rules defined.
-   Baseline comparison and leakage-safe evaluation complete.
-   Error/slice analysis reviewed.
-   Uncertainty/limitations shown.
-   Model version and lineage recorded.
-   Monitoring, disable and rollback tested.
-   Product owner and designated ML/QA reviewers approve release.

## Phase 4 --- medical

-   Intended use and boundaries documented.
-   Data/extraction/provenance/correction behavior validated.
-   Appropriate clinical/medical safety review complete.
-   Privacy/access review and regulatory assessment where applicable
    complete.
-   User-facing limitations and failure behavior approved.
-   Explicit release approval recorded.

## Phase 5 --- family

-   Person/access model and consent/revocation rules approved.
-   Family/caregiver/minor rules resolved.
-   Cross-person isolation tested across APIs, jobs, AI context,
    exports, logs and admin tools.
-   Users can see and revoke access as approved.
-   Audit and operational behavior tested.

------------------------------------------------------------------------

# 17. Change control

Changes must be reviewed for impact on product scope, phase commitments,
privacy, provenance, data lifecycle, APIs, offline sync, AI/ML safety,
security, costs, tests and future medical/family readiness. Significant
changes should record rationale, affected requirement IDs, owner,
compatibility/migration impact, tests and whether an open decision is
resolved.

Do not remove necessary requirements merely to make the project smaller.
Equally, a logical component does not automatically require a separate
hosted service. Manage complexity through clear ownership, phased
implementation, explicit trade-offs and verified behavior.

------------------------------------------------------------------------

# Appendix A --- Confirmed decisions preserved

-   VitalSense is a provisional name.
-   Advanced long-term ambition with phased delivery.
-   Web, Android and iOS are in scope.
-   Web: Next.js, React, TypeScript, Tailwind CSS.
-   Mobile: React Native + Expo.
-   Backend: FastAPI.
-   Central database: PostgreSQL.
-   ML: Python, Pandas, NumPy, scikit-learn initially.
-   Automation: n8n where viable, with application services enforcing
    rules.
-   Separate web/mobile API boundaries and shared identity/canonical
    health-data logic.
-   PostgreSQL is the synchronized source of truth; mobile local storage
    supports offline use and queued sync.
-   Native health integrations are preferred; a separate health
    app/wearable is not a prerequisite for all functionality.
-   Free-tier-first is a constraint, not a zero-cost guarantee.
-   AI summaries/major automation are Phase 2; validated ML forecasts
    are Phase 3.
-   Medical records/intelligence are committed Phase 4; family health is
    planned Phase 5.
-   No diagnosis/treatment claims under the general wellness scope.
-   No blind daily retraining or automatic promotion of unvalidated
    models.
-   Private records are not used for shared-model training without
    separate governance/consent.
-   Store individual Antigravity prompts in `prompts/`, not entire
    conversations by default.

# Appendix B --- Technical decisions still open

Exact Phase 1 sources/metrics; manual-entry categories; supported
OS/browser versions; native integration libraries; local
DB/encryption/key management; authentication/session implementation;
service transport/deployment boundaries; hosting; n8n/worker split; Phase
2 assistant UX/question scope/proactive triggers/usage limits; AI provider
and terms; model registry tooling; export format and deletion/retention
semantics; backup RPO/RTO; performance and forecast targets;
brand/monetization; medical intended use/validation; family
authorization.

## Revision history

| Version | Date | Summary |
|---|---|---|
| 1.0.1 | 26 October 2026 | Source baseline supplied for review. |
| 1.1.0 | 27 October 2026 | Candidate revisions separately added capability, lifecycle, API, synchronization, NFR and verification requirements. |
| 1.1.1 | 27 October 2026 | Merged both v1.1.0 candidate revisions. Kept the uploaded revision's integrated section structure; incorporated additional per-write-type sync, export/deletion acceptance, NFR exception/recovery and verification requirements; reconciled the decision register and row-level traceability matrix; retained unresolved decisions as open. |

**End of VitalSense SRS v1.1.1 — merged revised draft; approval-gated decisions remain open.**
