# VitalSense — Product Requirements Document (PRD)

**Version:** 1.1  
**Status:** Revised product baseline for product-owner review  
**Product name:** VitalSense (provisional; branding not finalized)  
**Document purpose:** Define what VitalSense will deliver, why it matters, who it serves, and the user experience it should provide.  
**Audience:** Product owner, design, engineering, data/ML, QA, and future clinical/privacy reviewers.

---

## Document conventions

To avoid confusing decisions with possibilities, this PRD uses the following labels:

- **Committed requirement / direction:** An established product-owner decision or capability committed to the roadmap.
- **Initial-release requirement:** Required for the first intended user-facing release, subject to explicitly listed source/platform feasibility and release gates.
- **Open decision:** A decision not yet made. This document records what must be decided and when; it does not silently choose an answer.
- **Assumption to validate:** A working assumption that needs evidence.
- **Candidate / optional enhancement:** A possibility for consideration, not a committed requirement.

Acceptance criteria in this PRD describe observable product behavior. They are not a substitute for the detailed functional, technical, security, and test specifications in the SRS.

## 1. Executive Summary

VitalSense is envisioned as a cross-platform personal health intelligence product that reduces the burden of manually tracking health information. It brings together available health and activity data from supported phone health platforms, compatible wearables and services, user-provided records, and optional manual entries. It presents that information in a unified, understandable experience.

The product goes beyond record storage. It helps users understand habits and progress through historical views, trends, goal guidance, AI-generated daily summaries and weekly reviews, and—when sufficient reliable data and validation are available—machine-learning (ML) forecasts. A substantial automation layer coordinates permitted data updates, quality checks, insight generation, reports, and notifications.

The product is delivered in phases. The **first deployable milestone** is the product and technical foundation needed to test the core tracking experience safely. The **first intended user-facing release** is the personal tracking foundation in Phase 1. AI daily intelligence and the substantial user-facing automation workflows belong to Phase 2; they are not silently included in Phase 1 merely because they are central to the long-term vision. The precise feature list and launch integrations must be finalized through the open decisions in Section 14 before release scope is frozen.

Medical records and responsible medical intelligence are **committed future capabilities** in Phase 4, not optional ideas. Family health management is a **planned future phase** in Phase 5. Initial product planning must preserve the architecture and roadmap foundations needed to deliver both without replacing the core.

VitalSense must be privacy-first, transparent about sources and limitations, and careful not to present experimental predictions as diagnoses or guarantees. The free-tier-first preference is a planning constraint, not a promise that every service, AI usage, device, or distribution cost will be zero.

## 2. Product Vision

**Vision:** Help people understand and manage their health over time by bringing their permitted health data together, making it understandable, and turning it into useful, responsible next steps.

VitalSense should feel like a personal health companion that works quietly in the background. Users should not need to become data analysts or repeatedly enter information that a supported device or platform can already provide.

### 2.1 Product promise

- **Collect:** Bring together available health data from supported sources with clear user permission.
- **Understand:** Present history, patterns, progress, and data quality clearly.
- **Personalize:** Use AI to explain information and provide relevant daily guidance in the planned AI phase.
- **Forecast:** Introduce evidence-based ML estimates when suitable data and validation support them.
- **Coordinate:** Automate routine syncing, reporting, and user-approved reminders where platform behavior allows.
- **Grow responsibly:** Add medical and family capabilities through planned phases without treating them as afterthoughts.

## 3. Problem Statement

Health information is often scattered across phone platforms, wearable apps, separate fitness services, medical documents, and manual records. Users may have difficulty seeing their overall history, recognizing long-term patterns, understanding progress toward goals, or preparing a coherent summary for a healthcare appointment.

Many tracking apps focus on recording and displaying individual measurements. VitalSense aims to combine tracking with understandable summaries, responsible forecasting, and background automation while preserving user control over personal health information.

### 3.1 Problems VitalSense intends to solve

1. **Fragmented data:** Useful health information is spread across multiple apps, devices, and documents.
2. **Manual effort:** Users may need to enter information that supported devices already record.
3. **Low interpretability:** Raw numbers and charts do not always explain what changed or how progress relates to a user's goals.
4. **Limited continuity:** Users need historical views and consistent records over time.
5. **Generic guidance:** Users benefit from summaries and suggestions grounded in their own available data.
6. **Unclear predictions:** Forecasts can be misleading when they omit uncertainty, data limitations, or the basis for an estimate.
7. **Repetitive administration:** Routine syncing, summaries, reports, and reminders can be coordinated automatically where technically supported.

### 3.2 Primary launch job to be done

The initial product is intended to help an individual **bring available personal wellness data into one place and reliably understand their recent activity, history, and progress without having to enter every record manually**.

This is the current product framing, not a claim that user research has validated it. The product owner/team must validate which first-release job and metric categories deserve priority when scope trade-offs are made (see Section 14).

## 4. Target Users

### 4.1 Primary launch audience

Individuals who want to understand and manage their own wellness and health information through one cross-platform experience.

Representative user needs include:

- A person who wants steps, sleep, heart rate, and workouts gathered from supported sources.
- A person who wants to see activity and sleep trends instead of opening multiple apps.
- A person working toward a goal who wants a realistic estimate of progress when enough data exists.
- A person who wants daily or weekly summaries based on their available data in the planned AI phase.
- A person who has medical reports or manually measured readings and wants them organized for later use.

These are user archetypes, not claims about a specific demographic or research findings.

### 4.2 Planned future audiences

- People managing a broader set of medical measurements and health records.
- People who need to prepare organized health summaries for appointments.
- Family members who, with explicit authorization and appropriate access controls, help manage another person's health information.

Family management is not an initial-release feature; it is a planned future capability in Phase 5.

## 5. Product Principles

1. **Automatic where possible:** Prefer authorized synchronization over repeated manual entry.
2. **Manual fallback:** Let users add or correct information when automatic collection is unavailable or unsuitable.
3. **One understandable view:** Organize data from multiple sources into a coherent experience while preserving source and timestamp context.
4. **Honest intelligence:** Distinguish recorded facts, calculated metrics, AI-generated explanations, and ML estimates.
5. **No false certainty:** Predictions must not be presented as guarantees. Show limitations and uncertainty where appropriate.
6. **Privacy and user control:** Data access must be permission-based, understandable, revocable, and limited to the product purpose.
7. **Designed for growth:** Medical and family capabilities must fit into the initial product foundation rather than require a replacement architecture.
8. **Phased delivery:** Plan the long-term product from day one, but release features only when they are usable, tested, and safe.
9. **Accessible experience:** Make core information understandable to first-time users, with clear language and useful visualizations.
10. **Free-tier-first development:** Prefer cost-conscious choices where feasible without promising that all hosting, AI usage, devices, or distribution will remain free.
11. **Purpose-limited data use:** Collect data needed for authorized product functionality, not unrelated health data merely for possible future model training. Any additional use requires clear purpose, disclosure, and appropriate authorization.
12. **Traceable information:** Preserve enough source, time, unit, correction, and transformation context to distinguish imported records from normalized records and derived outputs.
13. **Person-specific boundaries:** An account holder and the person represented by a health record are not necessarily the same person. The foundation must accommodate future person-specific records and authorization without enabling cross-person access by default.

## 6. Goals and Non-Goals

### 6.1 Product goals

- Support both iOS and Android.
- Reduce manual work by importing health data from supported platform integrations and compatible sources.
- Provide a unified personal health and wellness dashboard.
- Show historical records, trends, and progress toward user-defined goals.
- Generate useful AI-based daily summaries and weekly reviews in Phase 2.
- Provide appropriate ML-based forecasts as data availability and validation allow in Phase 3.
- Coordinate routine workflows, reports, and opt-in notifications.
- Establish a privacy-conscious foundation for future medical and family capabilities.
- Support a phased path from general wellness toward more medically oriented records and insights.

### 6.2 Initial non-goals

- Replacing a doctor, clinician, diagnostic service, or emergency service.
- Making a diagnosis or prescribing treatment.
- Guaranteeing outcomes such as a specific health improvement by a particular date.
- Claiming that every phone can measure every health metric without compatible hardware or an authorized data source.
- Requiring users to own a particular smartwatch to use the whole product.
- Automatically training a shared model on users' private health data without a separate, explicit governance and consent design.
- Automatically deploying newly trained ML models without evaluation and approval.
- Launching full family-management functionality in the first release.
- Shipping the full medical records and medical intelligence capability set in the first release.
- Treating interactive AI chat, unselected integrations, or unselected document formats as committed initial-release scope.

### 6.3 Release-scope matrix

| Scope level | Intended content | Status and boundary |
|---|---|---|
| **Phase 0: first deployable milestone** | Product discovery; cross-platform feasibility checks; requirements and data-category decisions; privacy/consent and provenance principles; extensible data and person concepts; core quality/safety criteria; a deployable foundation suitable for testing. | A foundation milestone, not a claim that the full user-facing product is complete. The exact deployment environment and technical acceptance criteria belong in the SRS. |
| **Phase 1: first intended user-facing release** | Personal onboarding; permission-aware connection to selected supported health platforms; initial supported data import; source status and timestamps; history/dashboard/charts; goals; transparent calculations; manual fallback where needed; basic data-quality handling; user privacy controls and notification preferences. | The first user-facing release. Exact initial metric/source list remains an open decision and must be frozen after feasibility review. AI daily summaries and broad automation are not assumed to be included. |
| **Phase 2: committed roadmap phase** | Daily briefings, weekly reviews, goal-progress summaries, personalized non-diagnostic suggestions, automated update/reporting workflows, workflow reliability monitoring. | Planned user-facing AI and automation phase; release only after the relevant quality and safety gates pass. |
| **Phase 3: committed roadmap phase** | Selected validated ML forecasts and personalization. | Only for use cases with suitable data, baseline comparison, evaluation, monitoring, uncertainty communication, and controlled release. |
| **Phase 4: committed future phase** | Medical records, supported report import, longitudinal medical measurements, responsible medical insights, potentially concerning-pattern detection where validated, user-reviewed medical summaries. | Planned future capability, not optional; must pass explicit medical readiness and release gates before launch. |
| **Phase 5: planned future phase** | Family health management, person-separated records, explicit authorization, and broader integrations. | Planned future capability, not an initial-release feature. Family roles and authorization rules remain open. |
| **Open decisions / optional enhancements** | Exact launch metrics and sources, AI chat timing, document formats, monetization, brand, and other decisions listed in Section 14. | Must not be treated as committed scope until the product owner/team explicitly decides. Optional enhancements are not blockers unless subsequently adopted. |

## 7. Core User Experience

### 7.1 First-use journey

1. The user installs VitalSense on an iPhone or Android device and creates an account or completes the supported onboarding flow.
2. VitalSense explains what kinds of information it can access and why.
3. The user chooses whether to connect supported health platforms, such as Apple Health on iOS or Health Connect on Android, and grants only the permissions they want.
4. VitalSense imports available permitted data and clearly indicates which categories are connected, unavailable, denied, or still syncing.
5. The user can set personal goals and preferences. Manual entry is available when automatic collection cannot provide the needed information.
6. The dashboard shows available records and explains when there is not yet enough history for a meaningful trend or forecast.

### 7.2 Ongoing journey

1. The app synchronizes new permitted data when the operating system and source integration allow it.
2. The product validates incoming records, retains source and timestamp context, and handles duplicates or conflicts carefully.
3. The dashboard and historical views update after successful processing.
4. In Phase 2, daily AI content summarizes relevant changes and progress using available data.
5. Rules and automation run eligible scheduled or event-triggered workflows subject to permissions, platform constraints, and user preferences.
6. Forecasts appear only when the selected prediction is supported by sufficient suitable data and has passed validation.
7. Users can inspect the underlying records, adjust goals, change permissions, disconnect sources, or disable optional notifications.

### 7.3 Example user experience

A user chooses a daily step goal. VitalSense imports step counts from a supported health platform, displays progress and historical averages, and may estimate a future goal milestone once enough reliable history exists and the forecasting capability has passed validation. AI, when available in Phase 2, can explain the estimate in plain language and suggest a practical next step. The estimate must be framed as conditional, not guaranteed.

### 7.4 Prioritized user stories and acceptance criteria

The following stories cover the core product behaviors. They are product-level acceptance criteria, not an exhaustive technical test plan.

#### US-01 — Onboarding and permissions (priority: P0)

**As an individual user,** I want to understand what VitalSense requests and why, so I can make an informed choice about connecting my data.

Acceptance criteria:

- The app explains the purpose of each requested data category before or at the point of requesting permission.
- The user can proceed with permissions denied or only partially granted; the app does not falsely report denied categories as connected.
- If the user skips connecting a source, the app provides an understandable next step and does not block unrelated functionality without a documented dependency.
- If no data is available yet, the dashboard shows an empty state and explains how data may become available; it does not fabricate values or display missing values as zero.

#### US-02 — Connect a health data source (priority: P0)

**As an individual user,** I want to connect a supported health source, so available records can be imported with less manual effort.

Acceptance criteria:

- The app identifies the connection attempt as successful, pending, denied, unavailable, or failed using language appropriate to the actual state.
- Only data categories authorized by the user and made available by the platform are imported.
- If the integration or permission is unavailable on that device/platform, the app explains the limitation and offers manual entry or another supported path where appropriate.
- Connection success is not presented as proof that every metric or all historical data is available.

#### US-03 — Understand source status and freshness (priority: P0)

**As an individual user,** I want to know where my data came from and how recently it was updated, so I can judge whether a view is current.

Acceptance criteria:

- Relevant views identify the source and time context of records or aggregates.
- The product distinguishes a recent successful sync from a source that is disconnected, denied, delayed, or has not yet supplied data.
- If freshness cannot be established, the product says so rather than implying real-time data.
- A stale source does not silently become a zero-value source.

#### US-04 — Review history and goals (priority: P0)

**As an individual user,** I want to review available history and progress toward my goals, so I can understand changes over time.

Acceptance criteria:

- Users can view available records and supported historical summaries over selectable periods defined for the release.
- The product shows an empty or insufficient-history state when records do not support a meaningful chart, trend, or comparison.
- Missing periods remain missing or are clearly identified; the product does not invent values to fill gaps.
- Calculated metrics are distinguishable from source-recorded values and have understandable units or labels.

#### US-05 — Receive daily/weekly AI summaries (priority: P1, Phase 2)

**As an individual user,** I want concise summaries grounded in my available records, so I can understand recent patterns without interpreting every chart myself.

Acceptance criteria:

- Each summary uses only authorized, available inputs relevant to its stated time period.
- The summary does not invent measurements, silently alter source records, assert unsupported causation, diagnose disease, or present unsupported suggestions as facts.
- If relevant data is missing, stale, or insufficient, the summary identifies that limitation or withholds the unsupported conclusion.
- The user can distinguish generated interpretation from recorded measurements and can access relevant source/time context.
- If generation fails, the app retains accessible underlying records and communicates that the summary is unavailable or delayed; it does not display a fabricated or falsely current summary.

#### US-06 — Handle insufficient forecast evidence (priority: P1, Phase 3)

**As an individual user,** I want forecasts only when there is enough suitable evidence, so estimates do not create false confidence.

Acceptance criteria:

- A forecast is shown only after its use case has defined readiness criteria and passed evaluation against an appropriate baseline.
- When history, data quality, or model evidence is insufficient, the product withholds the forecast and explains the limitation in understandable terms.
- A displayed forecast is labeled as an estimate, identifies its relevant input period or data basis where practical, and communicates uncertainty and limitations.
- A measured value is never visually or verbally presented as a forecast, or vice versa.
- A forecast that fails monitoring or release review can be disabled or rolled back without removing the underlying recorded data.

#### US-07 — Disconnect a source and manage associated data (priority: P0)

**As an individual user,** I want to disconnect a source and control its associated data, so I can revoke access.

Acceptance criteria:

- The user can initiate disconnection from the app's source-management experience.
- After disconnection, VitalSense does not initiate new imports from that source unless the user reconnects or another explicitly authorized mechanism applies.
- The app communicates what disconnection does and does not do to previously imported records and derived outputs, according to the data lifecycle policy.
- Deletion or retention behavior is not implied until the relevant policy has been decided and implemented; once decided, the behavior must be tested and described accurately.

#### US-08 — Recover from sync or processing failure (priority: P0)

**As an individual user,** I want to know when a sync or processing task has failed and what I can do, so I am not misled by incomplete or outdated information.

Acceptance criteria:

- A recoverable failure is retried under bounded, documented rules; repeated attempts do not create duplicate records or duplicate user-visible outputs.
- Partial success is represented as partial rather than as a complete refresh.
- The app shows an understandable status and a recovery action where user action can help.
- If AI generation or another derived process fails, existing source records remain accessible and the product does not substitute an unverified output.
- Delayed background execution is communicated as a platform or processing limitation when relevant, rather than being represented as guaranteed real-time synchronization.

### 7.5 Exception and recovery journeys

- **Interrupted onboarding:** Preserve completed choices where safe; allow the user to resume or skip optional connections. Do not imply setup is complete when required steps remain.
- **Partial or denied permissions:** Continue with available categories, show the unavailable categories, and provide a route to review permissions without pressuring the user to grant them.
- **No historical data:** Show an honest empty state, offer supported ways to add data, and defer trend/forecast claims until adequate history exists.
- **Disconnected or stale source:** Show the last known status/time where available, explain that data may be out of date, and offer reconnection or permission review.
- **Sync failure:** Preserve successfully imported records, identify partial/failure state, retry recoverable work, and prevent duplicate effects.
- **AI-processing failure:** Keep source data and non-AI views available; mark the generated summary unavailable or delayed.
- **Unreadable or ambiguous document (future capability):** Do not silently guess. Identify the affected fields, allow correction where document import is released, and clearly mark failed or incomplete extraction.

## 8. Product Capability Areas

### 8.1 Account, profile, and preferences

Users should be able to:

- Establish and manage their personal account and profile.
- Set goals and preferences relevant to supported features.
- Choose notification settings and quiet hours.
- Review connected sources and granted permissions.
- Disconnect integrations and manage personal information according to the agreed data-control policy.

Exact authentication methods and account lifecycle requirements will be detailed in the SRS.

### 8.2 Automatic health-data collection

VitalSense should minimize manual entry by reading permitted data from supported integrations.

Candidate data categories include:

- Steps and general activity.
- Heart-rate measurements where recorded by compatible devices or services.
- Sleep sessions and supported sleep-stage information.
- Workouts and activity duration.
- Distance and other supported activity metrics.
- Other health metrics made available by a supported source and explicitly permitted by the user.

Apple Health/HealthKit on iOS and Android Health Connect are the initial integration pathways. Direct integrations with individual device manufacturers or third-party services may be added when they provide material value and have feasible access terms.

**Platform reality:** Availability, frequency, granularity, history, and accuracy depend on the device, operating system, source application, permissions, and integration. Heart-rate and sleep data generally require a compatible device or service that records them; a phone alone cannot guarantee continuous collection. The product must not promise identical behavior across platforms when permissions, data types, or background execution differ.

#### 8.2.1 Requirements-level integration matrix

The precise initial source/metric list remains open. The table below records the established pathways and expected behavior without asserting unsupported coverage.

| Data category / source | Platform and prerequisites | Expected behavior and limitations | User-visible state and fallback |
|---|---|---|---|
| Steps and general activity from the platform health store | iOS via Apple Health/HealthKit; Android via Health Connect, subject to device, OS, app availability, and user permission. | Import only accessible, permitted records. Timing and historical coverage depend on the source and platform. Do not assume continuous or real-time refresh. | Show connection/permission state and available time context. If unavailable or denied, explain why where known; use manual entry only if the category is included in the approved release scope. |
| Heart rate | Same platform pathways where heart-rate records exist; typically requires a compatible recording device or service. | Do not infer heart rate from the phone or invent readings. Source sampling and coverage may be irregular. | Show unavailable/empty state when no readings exist; never display missing as zero. |
| Sleep sessions/stages | Same platform pathways where a compatible device/service has recorded sleep data and the user has granted permission. | Do not promise that a phone alone records sleep or that all sources provide sleep stages. | Explain that no data is available or the source does not provide that detail. Do not infer sleep duration from absent records. |
| Workouts, activity duration, distance, and other supported metrics | Platform pathway or explicitly selected compatible source; availability varies by source and platform. | Import only fields supported by the selected source and approved release scope. Preserve original timestamps/units and source context. | Identify unsupported categories and provide a fallback only where a suitable manual-entry path is approved. |
| Manual measurements/entries | App feature and user input; exact first-release categories are open. | Record that information was manually entered and retain the provided time/context where available. Do not misrepresent manual entries as device-verified. | Allow the user to review and correct an entry according to the approved correction policy. |
| Medical documents and reports | Planned future document-import capability; supported formats and extraction scope are open. | Must be a controlled import workflow with source provenance, extraction-quality handling, correction, and failure states. Document extraction is not clinical interpretation. | In Phase 4, show unreadable/ambiguous/partially extracted fields and permit review/correction before using extracted data in derived outputs. |

For each source/metric selected for launch, the SRS and QA plan must specify: permission prerequisites; supported fields and units; sync triggers and realistic timing; source freshness/status; handling of missing, delayed, duplicate, conflicting, or invalid records; disconnection behavior; and recovery path. This detail must be based on platform and integration feasibility checks, not assumptions.

#### 8.2.2 Data quality and conflict handling

- Preserve source identity, source timestamp, units, and provenance when available.
- Validate incoming records for basic structural and plausibility problems before using them in summaries or calculations.
- Handle duplicate records consistently and idempotently; retries must not multiply records or outputs.
- Do not silently overwrite conflicting records. The product must use a documented resolution policy or expose the conflict for review where appropriate.
- Distinguish missing data from a measured zero, and distinguish delayed data from a current reading.
- Where source values, units, or timestamps cannot be interpreted reliably, do not use them in derived outputs until resolved or excluded with an appropriate status.
- Corrections must retain enough history or provenance to explain which value is currently used and why, subject to the data lifecycle policy.

### 8.3 Manual entry and document import

Automatic collection is preferred, not mandatory for every data type. Users should have a way to enter relevant measurements or information that cannot be imported, within the categories approved for the release.

The product should support a planned document-import pathway for health reports and records. Supported file types and the timing of document import remain open decisions; the roadmap must retain the capability as future scope where specified. Once document import is approved for a phase, requirements must cover:

- Source file and page/section provenance where available.
- Clear distinction between extracted text/fields and software-generated interpretation.
- Confidence or ambiguity communication where the chosen extraction method supports it; no unsupported certainty.
- User review and correction of extracted fields before they are treated as confirmed user data.
- Handling of unreadable, incomplete, contradictory, or unsupported documents.
- Failure status and a safe retry or replacement path.
- Privacy and access controls for uploaded files, extracted fields, and derived outputs.

Document extraction must remain distinct from clinical interpretation. A document parser must not silently invent missing values.

### 8.4 Dashboard, history, and visual analytics

The product should help users answer:

- What has been recorded recently?
- How has a metric changed over time?
- How am I progressing toward my chosen goals?
- Which data sources contributed to this view?
- Is there enough data to support the displayed trend or forecast?

Expected experiences include daily summaries, historical timelines, date-range views, charts, goal-progress views, and clear empty states when data is unavailable. The initial release includes the history/dashboard capabilities listed in the Phase 1 scope matrix. The product must not invent values to fill missing periods.

Where practical, users should be able to distinguish:

- **Recorded value:** Supplied by a connected source or entered by the user.
- **Normalized record:** A source record converted to a consistent representation without changing its meaning.
- **Calculated metric:** Produced by a stated rule or calculation.
- **AI-generated explanation:** Language generated from available records and context.
- **ML forecast:** An estimate about a future outcome, not a measured fact.

Source, time period, units, and relevant limitations should be available where they materially affect interpretation.

### 8.5 Goals and progress

Users should be able to define relevant goals and review progress. Early goal calculations can use transparent rules and statistics rather than requiring a trained ML model.

Possible examples include step targets, activity minutes, workout consistency, or other supported user-defined wellness goals. Exact initial goal types are subject to release-scope decisions. Goal recommendations must be presented as optional guidance, not medical instructions.

### 8.6 AI-generated daily intelligence — Phase 2

AI is responsible for generating understandable, contextual content from the user's authorized and available information.

Planned capabilities:

- Daily briefing based on recent records and trends.
- Weekly review and progress recap.
- Plain-language explanations of charts and observed changes.
- Personalized suggestions related to user-selected goals and available data.
- Explanations of forecasts, including assumptions and limitations.
- Future possibility of an interactive assistant that answers questions about the user's own data within explicit permissions and safety boundaries.

Interactive AI chat is an open timing decision; it must not be treated as initial-release scope without an explicit decision.

AI must not fabricate measurements, silently change source records, claim causation from simple correlations, diagnose disease, or present unsupported recommendations as established facts. If data is missing or ambiguous, it should say so. Outputs should identify the relevant input period/source context where practical and distinguish generated interpretation from recorded facts. AI output must not be treated as authoritative when its inputs are stale, incomplete, or unavailable.

Before Phase 2 release, the team must test for fabricated measurements, unsupported claims, misleading certainty, mishandling of missing/stale data, and failure behavior. If generation fails, the product must preserve access to underlying records and clearly mark the output as unavailable or delayed.

### 8.7 ML-based forecasting and personalization — Phase 3

ML is responsible for estimating future outcomes or identifying patterns where an appropriate target, suitable data, and a validation method exist.

Potential forecast areas, subject to validation:

- Estimated time to reach a user-defined activity goal based on recent behavior.
- Expected activity or workout totals over a future period.
- Personal activity or sleep baselines and deviations from them.
- Other forecasts introduced only after feasibility and safety review.

VitalSense does not need a custom-trained model before the first app release. The system should collect data needed for authorized product functionality from day one, begin with transparent calculations and statistical baselines, and introduce ML models when evidence supports them. This does **not** mean collecting unrelated personal health data for hypothetical training, retraining models every day, or automatically deploying unvalidated models. General models trained on suitable, lawfully obtained datasets may be considered when appropriate; personal adaptation can follow as sufficient user history accumulates.

Each forecast use case must define its intended outcome, suitable input data, minimum evidence/readiness criteria, an appropriate baseline for comparison, evaluation method, limitations, and release decision before being enabled. Numeric minimum-history or error thresholds are not set in this PRD; they require evidence and explicit approval.

Model lifecycle requirements:

- Evaluate a candidate model against an appropriate transparent baseline before release.
- Record the model/version and relevant input period or data provenance needed to interpret the output.
- Monitor performance after release using privacy-conscious measures and an agreed review process.
- Use controlled model updates with evaluation, versioning, approval, and rollback/disable capability.
- Communicate uncertainty and limitations in understandable language.
- Withhold a forecast when input history, quality, or validation evidence is insufficient.
- Treat routine ingestion and calculation as separate from model retraining and deployment.
- Require a separate privacy, consent, and governance design before shared learning across users.

### 8.8 Automation and proactive workflows

Automation is a major product capability, not just a reminder scheduler. It should coordinate routine work across the product, including:

- Processing new data received through supported integrations.
- Running data-quality checks and duplicate handling.
- Updating summaries and analytics after eligible changes.
- Scheduling daily and weekly AI-generated content in Phase 2.
- Triggering eligible forecast workflows when relevant data arrives or on an appropriate schedule in Phase 3.
- Sending user-approved reminders and notifications.
- Generating periodic reports and preparing health summaries where included in the relevant phase.
- Monitoring failed workflows, retrying recoverable jobs, and surfacing sync or processing problems.
- Coordinating future document-processing and family workflows under the appropriate permissions.

Automation requirements:

- Repeated delivery or retries must not create duplicate records, summaries, or notifications.
- Recoverable failures should be retried under bounded rules; unrecoverable failures must be marked rather than retried indefinitely.
- Partial success and delayed jobs must be distinguishable from completed jobs.
- User-visible status should explain meaningful failures and the next action when one is available.
- The product should preserve valid completed work if a later step fails.
- Automated outputs must respect the same source, permission, quality, and safety constraints as user-triggered outputs.
- Automation must respect user preferences, permissions, rate limits, and quiet hours.
- It must not make autonomous medical decisions, independently change treatment, or deploy an unvalidated model.
- Mobile operating-system restrictions mean some syncing may occur only when the app or source platform permits it; the product must communicate these limitations honestly.

A user-facing workflow history/status screen is an optional enhancement unless product discovery shows it is necessary to resolve user confusion.

### 8.9 Reports and health summaries

Users should be able to review or export useful summaries of their own information where supported and included in the relevant phase.

Planned capabilities include:

- Time-bounded activity and wellness summaries.
- A consolidated view of relevant recorded measurements.
- A summary users can review before sharing with a healthcare professional.
- Source and timestamp context so users can distinguish imported, manually entered, and derived information.

Reports must not imply that information is a verified clinical record unless verification is actually provided. Export formats, sharing pathways, and report scope remain open decisions. Export must follow the agreed privacy and data lifecycle policies.

### 8.10 Medical records and medical intelligence — committed future phase (Phase 4)

Medical capabilities are a planned part of VitalSense's product evolution. They are not an optional afterthought, and the initial product should be designed so they can be added without replacing the core.

Candidate capabilities for later phases include:

- Longitudinal medical measurements, including blood pressure, blood glucose, and temperature.
- Structured health history and relevant medical information.
- Importing and organizing supported medical reports.
- Trends across recorded measurements.
- Carefully scoped flags for potentially concerning patterns.
- User-reviewed summaries intended to support conversations with healthcare professionals.
- Digital medical summary or emergency-oriented card concepts, with clear limitations and user control.

Medical interpretation and potentially concerning pattern detection require stronger evidence, clinical review, careful context handling, and safety evaluation than general wellness summaries. These capabilities must not be released as diagnostic or treatment guidance without appropriate validation and governance. The roadmap must explicitly include the discovery, validation, and implementation work required for this phase.

#### 8.10.1 Initial architecture-readiness requirements

These requirements apply to the initial product foundation; they do **not** mean medical features ship in Phase 1.

- Preserve source identity, timestamp, units, and provenance where available for imported, manually entered, normalized, or derived information.
- Keep source records distinguishable from normalized records, calculations, AI summaries, and ML forecasts.
- Provide a defined way to represent corrections, duplicates, conflicts, and unavailable/uncertain values.
- Preserve enough transformation and version context to explain how a derived output was produced, where applicable.
- Design health records around the person represented by the record, not only the account that accesses the app.
- Ensure future access can be restricted by person and explicit authorization; cross-person access must not be enabled by default.
- Ensure future medical records and insights can be traced to their underlying source records and relevant processing/interpretation version.
- Establish a data lifecycle policy that accounts for source files, extracted fields, derived outputs, export, deletion, retention, and backup copies before medical-document features are released.

#### 8.10.2 Medical-phase entry and release gates

Before Phase 4 implementation scope is finalized, the product owner/team must define the intended use and boundaries of each medical capability. Before any medical-oriented capability is released, the phase must have:

- A documented intended-use statement and clear non-goals.
- Defined eligible data sources, data-quality requirements, provenance, and handling of missing/conflicting records.
- A validation approach appropriate to the intended capability and its risks.
- Clinical/medical safety review appropriate to the capability.
- A regulatory assessment where applicable, without presuming a classification in this PRD.
- User-facing limitations, escalation language, and a plan for potentially concerning patterns where relevant.
- Privacy, authorization, data lifecycle, and failure-mode review.
- Explicit release approval by the designated product and review owners.

These are readiness deliverables, not a pre-judgment of regulatory status or a guarantee that a particular feature is appropriate to release.

### 8.11 Family health management — planned future phase (Phase 5)

Family features are planned for a later phase. The product foundation should support future separation of records by person and explicit authorization, without enabling cross-person access by default.

Potential capabilities include separately organized profiles and records, authorized caregiver access, and family-specific summaries. Consent, age-related considerations, access revocation, and the distinction between account ownership and the person whose health data is represented must be resolved before release.

Before Phase 5 release, the product owner/team must approve the person/role model, permission and consent rules, access revocation behavior, and any applicable minor/caregiver requirements. This PRD does not invent family roles or sharing policies.

## 9. Release Strategy and Product Roadmap

The complete product vision should inform planning from the beginning, while implementation proceeds in safe, achievable phases. “Future scope” means planned work with a place in the roadmap and foundational requirements—not a vague promise to consider it later.

### Phase 0 — Product and foundation definition

- Validate user needs, the primary launch job, workflows, and success-measure baselines.
- Define initial data categories, consent expectations, source provenance, and privacy principles.
- Design extensible health-record concepts and clear distinctions between source, normalized, manually entered, calculated, AI-generated, and ML-predicted information.
- Define person-specific record boundaries and future authorization needs.
- Define integration feasibility and constraints for iOS and Android.
- Establish core data-quality criteria and release gates for the first deployable foundation.
- Establish the quality and safety criteria for future forecasting and medical capabilities.
- Resolve the first-release scope decisions identified in Section 14 before scope is frozen.

### Phase 1 — Personal tracking foundation (first intended user-facing release)

- Cross-platform onboarding and permission-aware connection to selected supported health platforms.
- Initial automatic import of approved supported steps, activity, heart-rate, sleep, and workout records, subject to the final metric/source decision and platform feasibility.
- Data-source status, timestamps, history, and basic data-quality handling.
- Dashboard, charts, user goals, and transparent calculations.
- Manual entry where included in the approved scope and automatic collection is not available.
- Privacy controls, source disconnection, and user-approved notification preferences.
- Empty, denied-permission, stale-data, partial-sync, and failure states for the included capabilities.

Phase 1 does not implicitly include AI daily briefings, interactive AI chat, validated ML forecasting, medical intelligence, or family health management.

### Phase 2 — AI daily intelligence and automation

- Daily briefings and weekly reviews.
- Automated update and reporting workflows.
- Goal-progress summaries and personalized, non-diagnostic suggestions.
- Workflow reliability monitoring and notification preferences.
- AI safety and failure handling described in Sections 7 and 8.

### Phase 3 — Validated ML forecasts

- Introduce selected forecasts when appropriate data and validation are available.
- Show uncertainty, limitations, and relevant model provenance in understandable language.
- Monitor performance and maintain controlled model updates.
- Do not force a forecast when evidence is insufficient; provide a clear unavailable state.
- Disable or roll back forecasts that fail agreed review criteria.

### Phase 4 — Medical records and responsible medical insights

- Implement structured medical measurements and record history.
- Add supported report import and health-summary workflows.
- Validate any concerning-pattern detection or medically oriented interpretation before release.
- Establish stronger safety review, documentation, intended-use boundaries, regulatory assessment where applicable, and escalation language appropriate to the capability.
- Release only after the medical readiness gates in Section 8.10.2 are satisfied.

### Phase 5 — Family health management and broader integrations

- Add separately managed family records and explicit access permissions.
- Expand compatible device and service integrations based on feasibility and user value.
- Extend reporting and automation under clear consent and access controls.
- Release only after the person/role, authorization, consent, and revocation decisions have been approved.

Phases may be refined after discovery and testing, but the medical and family phases must remain visible as planned roadmap commitments. This PRD does not claim that any phase has already been implemented.

## 10. Privacy, Trust, and Safety Requirements

At the product level, VitalSense must:

- Explain why a permission or data category is requested.
- Let users choose which supported data categories to share where the platform permits granular consent.
- Make source, timestamp, and data availability visible when relevant.
- Provide a clear way to disconnect integrations and manage personal information according to the agreed lifecycle policy.
- Avoid collecting data unrelated to the feature's stated purpose.
- Separate recorded data from derived calculations and generated insights.
- Avoid using an individual's health data for shared model training without an explicitly designed, disclosed, and appropriately authorized process.
- Avoid diagnosing, prescribing treatment, or replacing professional care.
- Avoid implying that an app-generated health summary is a verified medical document.
- Use careful language for abnormal or potentially concerning measurements and define the appropriate safety response before releasing medical-oriented functionality.
- Keep data access person-specific and permission-controlled as future family capabilities are introduced.

### 10.1 Release-readiness checks

A release must not pass its applicable product release gate until the team has verified the following for the included capabilities:

1. **Permissions and access:** Denied, partial, revoked, and granted permissions produce the expected behavior; unauthorized data is not imported or exposed.
2. **Disclosure:** User-facing explanations accurately describe which categories are accessed, why, and any meaningful platform limitations.
3. **Source disconnection:** Disconnection stops new imports as expected and communicates the agreed treatment of previously imported data.
4. **Data lifecycle:** Retention, export, deletion, derived-output, and backup-copy behavior is documented and tested once the relevant policies have been decided. The PRD does not promise a specific deletion outcome before that decision.
5. **Data integrity:** Missing, stale, duplicate, conflicting, invalid, and partially imported records are handled without fabricating values or misleading the user.
6. **AI safety (Phase 2):** Testing covers fabricated measurements, unsupported claims, misleading certainty, missing/stale inputs, and processing failure.
7. **Forecast safety (Phase 3):** Each forecast has documented readiness criteria, baseline comparison, evaluation, uncertainty communication, monitoring, and disable/rollback behavior.
8. **Medical safety (Phase 4):** Intended use, validation, appropriate clinical review, regulatory assessment where applicable, privacy/access review, and explicit release approval are complete.
9. **Family access (Phase 5):** Person-specific authorization, consent, revocation, and access-isolation behavior are tested before family records are exposed.
10. **Operational reliability:** Eligible workflows handle retries, partial failures, delays, duplicate events, and user-visible status according to Section 8.8.

Detailed security controls, retention rules, deletion behavior, access policies, compliance obligations, and incident response are to be specified in the SRS and reviewed against applicable requirements before release. This PRD does not assert a regulatory classification.

## 11. Product Success Measures

Success should be evaluated through usability, reliability, engagement, data quality, and trust. Initial numeric targets must be set after baseline testing rather than invented prematurely.

For each adopted measure, the product owner/team must document: **definition and calculation; eligible population; measurement window; source/instrumentation; segmentation where relevant; privacy implications; baseline; target-setting method; and decision owner.** The team must decide which measures are appropriate for each phase rather than assuming every candidate metric is required from the first release.

Candidate measures:

- Onboarding completion rate.
- Percentage of users who successfully connect at least one supported data source.
- Sync success rate and freshness of available records.
- Frequency of duplicate, invalid, or incorrectly attributed records.
- User understanding of data source, forecast uncertainty, and insight limitations.
- Usefulness ratings for daily briefings and weekly summaries.
- Continued use of history, charts, and goals.
- Forecast error and calibration for each released ML use case.
- Notification opt-out and complaint rates.
- User-reported trust, privacy clarity, and ease of controlling data.
- Accessibility and usability across supported screen sizes and platforms.
- Failure/recovery rates for included synchronization and processing workflows.

Engagement alone must not be treated as proof that health advice or predictions are correct or beneficial. Targets for first-release success and later AI/ML outcomes remain open and must be set after appropriate baseline testing and product-owner review.

## 12. Key Risks and Product Responses

| Risk | Product response |
|---|---|
| Different devices expose different metrics | Show source availability clearly; never promise universal measurement support. |
| Users have little history at first | Start with basic summaries and transparent calculations; withhold unsupported forecasts. |
| Imported data is incomplete or duplicated | Preserve provenance, validate records, handle duplicates consistently, and avoid silent conflict resolution. |
| AI creates misleading explanations | Ground content in available records, disclose uncertainty, test unsupported claims, and retain access to source data if generation fails. |
| ML forecasts are unreliable | Validate each use case, compare with an appropriate baseline, monitor errors, show limitations, and disable forecasts when unsuitable. |
| Medical insights may be misinterpreted | Treat medical capabilities as a separately validated phase with stronger safeguards and explicit release gates. |
| Automation runs too often or fails silently | Use bounded retries, duplicate-safe processing, monitoring, and clear status messages. |
| Free-tier limits change or are insufficient | Design cost-conscious modular services and disclose likely operational costs during planning. |
| Family access exposes another person's data | Keep family management out of launch and require explicit future authorization and access controls. |
| Future scope becomes an architectural rewrite | Include extensibility, source provenance, corrections, person-specific records, permissions, and roadmap dependencies in initial planning. |
| Data retention or deletion expectations are unclear | Resolve the data lifecycle policy before promising specific behavior; communicate the approved policy accurately. |
| Platform background work is delayed or restricted | Show freshness/status and explain limits; do not promise real-time synchronization where the platform cannot guarantee it. |

## 13. Dependencies and Constraints

- iOS and Android health-data access is subject to platform permissions, supported APIs, operating-system behavior, and available source data.
- Heart-rate and sleep data generally require a compatible device or service that measures and records them; a phone alone cannot guarantee continuous collection.
- Data access from third-party manufacturers may be limited, paid, or subject to approval and terms.
- Background synchronization timing may differ across iOS and Android; product behavior must be tested on both rather than assuming parity.
- AI service use may create recurring costs or usage limits. A free-tier-first goal is a constraint to evaluate, not a guarantee of zero cost.
- Useful ML forecasting depends on a clearly defined prediction target, suitable training or historical data, evaluation, and monitoring.
- Medical-oriented features require additional discovery and validation before their scope and release criteria can be finalized.
- Medical document import requires decisions about supported formats, extraction quality, user review, and privacy.
- Future family features require person-specific records and approved authorization rules.
- Branding is not finalized; VitalSense is a working name.
- Monetization remains undecided and should not be treated as a confirmed requirement.

## 14. Assumptions and Open Decisions

Open decisions are not automatically defects. They become delivery blockers when they affect a milestone's scope, safety, cost, data use, or acceptance. The product owner owns product direction and prioritization; engineering/platform specialists provide feasibility evidence; QA contributes acceptance and test evidence; appropriate privacy/clinical reviewers contribute for the relevant future phases. Where a named individual has not been assigned, the role is stated rather than invented.

### 14.1 Confirmed product direction

- Cross-platform support for iOS and Android.
- Automatic data collection is preferred over requiring manual entry for all information.
- Apple Health/HealthKit and Android Health Connect are initial integration pathways.
- AI generates daily and weekly summaries, explanations, and personalized guidance in Phase 2.
- ML forecasts are introduced when suitable data and validation support them.
- Automation includes data processing, quality checks, analytics, AI/ML workflows, notifications, reports, and reliability monitoring across the relevant phases.
- The product should be privacy-first and designed for a free-tier-first build.
- Individuals are the initial audience; family health management is a planned later phase.
- Medical records and responsible medical intelligence are a committed future phase and must be accounted for in the initial design.
- A custom ML model does not need to be trained before app development begins.
- Model updates require evaluation and controlled release; daily automatic retraining/deployment is not a product requirement.
- Future scope means planned work that remains in the roadmap, not a vague optional idea.
- Collection from day one means collection needed for authorized product functionality, not unrelated collection for hypothetical model training.

### 14.2 Open decision register

| ID | Decision required | Why it matters / evidence needed | Owner | Resolve by |
|---|---|---|---|---|
| OD-01 | Final first-release metric categories and source integrations | Compare platform/API availability, permissions, history, reliability, testing effort, user value, and cost on iOS and Android. | Product owner, with engineering/platform feasibility input | Before Phase 1 scope is frozen and before implementation estimates are treated as final |
| OD-02 | Priority trade-off if not all candidate metrics fit Phase 1 | Validate the primary launch job and highest-value first-release workflow; use discovery/testing rather than inventing a demographic or need. | Product owner; user research evidence where feasible | Phase 0, before Phase 1 scope freeze |
| OD-03 | Meaning of “first deployable milestone” in the chosen deployment environment | Define what must be deployable and demonstrable, and how the foundation is accepted. | Product owner and engineering | Phase 0, before foundation acceptance |
| OD-04 | Exact manual-entry categories in Phase 1 | Determine which categories are necessary when automatic collection is unavailable, and the expected correction behavior. | Product owner with design/engineering input | Before Phase 1 scope freeze |
| OD-05 | Whether interactive AI chat is included in the first AI release or a later phase | Requires user-value, safety, privacy, and cost assessment. | Product owner with AI/engineering and privacy input | Before Phase 2 scope freeze |
| OD-06 | Initial document-import formats and extraction capabilities | Assess likely documents, extraction quality, user correction, provenance, privacy, and failure handling. | Product owner with engineering and future clinical/privacy reviewers | Before document import is scoped for implementation; no later than Phase 4 discovery |
| OD-07 | Data lifecycle policy: retention, export, deletion, derived outputs, and backups | Define user expectations, technical feasibility, and applicable obligations; test behavior after policy approval. | Product owner with engineering and privacy/legal review as applicable | Before promising data controls in a release; before any release that offers export/deletion |
| OD-08 | Final product name, visual identity, and brand availability | Brand and naming decision. | Product owner | Before public branding/launch |
| OD-09 | Monetization model: fully free, freemium, or undecided | Assess cost sustainability and user expectations; free-tier-first remains a constraint, not a guarantee. | Product owner | Before committing to ongoing service costs or public pricing claims |
| OD-10 | Success-measure definitions and numeric targets | Establish baselines, measurement windows, instrumentation, privacy review, and evidence-based target-setting. | Product owner with analytics/QA input | Definitions before relevant measurement ships; targets after baseline testing and before success evaluation |
| OD-11 | Forecast readiness and acceptance thresholds per use case | Requires target definition, suitable data, baseline comparison, evaluation, uncertainty, and monitoring evidence; do not use invented thresholds. | Product owner with ML/QA review | Before each forecast is approved for Phase 3 release |
| OD-12 | Medical intended use, validation approach, review roles, and boundaries for concerning-pattern flags | Requires data-quality plan, validation, clinical safety review, user-facing limitations, regulatory assessment where applicable, and explicit approval. | Product owner with appropriate clinical/medical, privacy, engineering, and regulatory expertise | During Phase 4 discovery and before any medical capability is released |
| OD-13 | Family authorization model, caregiver roles, minors, consent, and revocation | Must define who can view or manage which person's records and how access is granted/revoked. | Product owner with privacy/legal review as applicable | During Phase 5 discovery and before family functionality is released |
| OD-14 | Export formats and sharing pathways for reports/medical summaries | Assess user needs, privacy, supported formats, and risks of stale or misunderstood information. | Product owner with design/engineering and relevant reviewers | Before the relevant report/export feature is scoped for release |
| OD-15 | Whether a user-facing workflow history/status view is needed | Validate whether status messages and recovery actions alone are sufficient or users need a broader history. | Product owner with user feedback/design input | During Phase 1/2 usability review, before adding as committed scope |

### 14.3 Assumptions to validate

- The initial integration pathways will expose enough useful data for a valuable personal tracking release; this must be confirmed through platform feasibility checks.
- Users will benefit from one consolidated history and clear source/freshness status; this should be tested through usability work.
- Some users will have limited history at onboarding; the product must work honestly in that state.
- Free-tier-first services may be sufficient for development and early testing, but production costs and limits may change.

These are not established user-research findings. If evidence contradicts them, the product owner should revisit scope explicitly.

### 14.4 Optional enhancements — not committed requirements

The following may be considered if they solve a demonstrated user need and do not distract from core requirements:

- A lightweight user research plan focused on high-risk assumptions.
- More visible provenance/explanations for selected metrics or summaries.
- Interactive AI chat, subject to OD-05.
- Forecast history showing prior forecasts alongside later observed outcomes.
- A user-facing workflow activity/status history, subject to OD-15.
- Additional export formats or a more polished emergency card, subject to user needs and privacy constraints.
- A capability-to-source traceability appendix if it helps future review.

These items must not be presented as committed release scope unless explicitly adopted.

## 15. Source Material and How It Informs VitalSense

The following supplied documents were used as reference material for candidate capabilities. Their original technology choices and implementation assumptions are not automatically adopted by VitalSense.

### 15.1 `HealthSync_Personal_Wellness_Tracking_Application.docx`

Reference capabilities:

- User registration and login.
- Personal and family member record organization.
- Timestamped blood-pressure readings.
- Blood-glucose records categorized as fasting, post-meal, or random.
- Temperature records.
- Historical record review and trend tracking.

VitalSense adaptation:

- Personal medical measurements and longitudinal history are included in the planned medical phase.
- Family management is planned for a later phase, not the initial release.
- Automatic data collection and cross-platform health integrations extend beyond the reference's manual-entry Android application.

### 15.2 `FitTrack_Pro_Python_ML.docx`

Reference capabilities:

- Personal profile and activity history.
- Activity type, duration, and intensity.
- MET-based calorie estimation using activity, duration, and user weight.
- Daily, weekly, and monthly progress reports with charts.

VitalSense adaptation:

- Activity history, progress views, and scientifically grounded calculations are candidate product capabilities.
- Calories should be shown only where the source data or calculation method supports them, with clear indication when estimated.
- The reference's Django and SQLite stack is not adopted; VitalSense's technical stack is documented separately in the SRS.

### 15.3 `Smart_Health_Card_Generator_Android_App_SQLite.docx`

Reference capabilities:

- A formatted medical card containing personal and selected medical information.
- PDF/image export.
- Emergency-oriented presentation.
- Local record storage.

VitalSense adaptation:

- A user-controlled medical summary or emergency-oriented card may be considered within the medical-records roadmap.
- Exported information must be clearly labeled and must not be represented as clinically verified unless a real verification process exists.
- Security, privacy, access, and data freshness requirements must be established before release.

## 16. Relationship to the SRS

This PRD defines product intent, user problems, user-facing capabilities, roadmap phases, and product-level quality expectations.

The SRS and technical design should specify how the approved requirements will be implemented, including:

- System architecture and component boundaries.
- Web and mobile application responsibilities.
- Health-platform integration behavior and limitations for the selected metric/source scope.
- Data model, provenance, permissions, person-specific boundaries, corrections, and API contracts.
- AI and ML lifecycle, validation, monitoring, versioning, and rollback.
- Automation workflows, idempotency, retries, status, and failure handling.
- Security, privacy, retention, deletion, export, backup, performance, accessibility, reliability, and testable acceptance criteria.
- Phase-specific release gates and traceability from requirements to tests.

The SRS must preserve the product requirements and future-phase commitments in this document. It should not silently downgrade medical capabilities or family management to unplanned ideas. The SRS may specify implementation details but must not resolve product-owner decisions listed in Section 14 without an explicit decision.

---

## Revision notes — v1.1

This revision clarifies the first deployable milestone versus the first intended user-facing release; adds prioritized user stories and observable acceptance criteria; defines key exception/recovery behavior; expands cross-platform integration, freshness, provenance, and data-quality requirements; strengthens architecture readiness for committed medical and family phases; introduces phase-specific privacy, safety, ML, automation, and medical release gates; defines a method for measuring success without inventing numeric targets; and records open decisions with owners and resolution milestones.

**Preserved commitments:** The original VitalSense vision, cross-platform and automatic-data-collection direction, AI/ML/automation separation, free-tier-first constraint, and planned Phase 4 medical and Phase 5 family capabilities remain intact. Open decisions remain open unless explicitly established in the original product direction.

**Document status:** Complete revised PRD v1.1 for product-owner review. It is not a claim that implementation, validation, or any roadmap phase is complete.
