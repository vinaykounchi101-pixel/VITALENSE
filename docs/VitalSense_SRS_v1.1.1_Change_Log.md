# VitalSense SRS v1.1.1 — Merge Change Log

## Purpose and baseline

This is a reconciliation of two candidate v1.1.0 packages:
- the user-uploaded `VitalSense_SRS_v1.1.0_Revision_Bundle.zip`;
- the companion `VitalSense_SRS_v1.1.0_Review_Package.zip`.

The uploaded bundle supplies the main SRS structure because its requirements are more integrated into the appropriate sections. The companion package contributes additional detailed acceptance requirements and the richer CSV traceability fields. This is a merge, not a claim that either v1.1.0 candidate was formally approved.

## Substantive changes

| Area | Merge action | Reason / effect |
|---|---|---|
| Main SRS structure | Retained the uploaded candidate's integrated Sections 1–17 and its capability, lifecycle, API/event, deployment and NFR sections. | Keeps the more navigable structure and avoids moving all implementation contracts into appendices. |
| Offline synchronization | Added `SYNC-015`–`SYNC-020` covering account-bound queued operations, deterministic deduplication, concurrent updates, correction history, deletion with pending writes, and ordering/retry/failure semantics. | Preserves detailed, testable sync obligations from the companion candidate. |
| Export/deletion lifecycle | Added `PRV-012`–`PRV-016` covering workflow status, evidence-backed deletion completion, account-bound local queues, deletion reconciliation after restore, and minimum audit evidence. These supplement `DATA-011`–`DATA-016` and existing `PRV-*` requirements. | Retains additional observable acceptance criteria without inventing retention or deletion policy. |
| NFR release gates | Added `NFR-REL-007`–`NFR-REL-010` for approved targets or time-bounded exceptions, reproducible evidence, exception expiry, and deletion-aware restore drills. | Strengthens the link between NFR approval and release readiness. |
| Verification scenarios | Added `TEST-009`–`TEST-012` for deletion propagation, backup restoration, API contract/security, and third-party/asynchronous failure. | Extends scenario coverage; these are test scenario IDs, not product requirement IDs. |
| Requirement traceability | Merged both inventories into a CSV with 348 unique requirement IDs and 17 columns. The matrix retains detailed VFY verification fields and the prior uploaded inventory's VT IDs where present. | Combines broad inventory coverage with detailed test planning fields. |
| PRD trace | Set PRD trace to TBD for every row because the authoritative PRD was not supplied with the two bundles. | Avoids claiming unverified PRD mappings. |
| Open decisions | Retained OD-01–OD-22 and the more detailed options, owners, risks and decision gates from the companion register. | Ensures unresolved decisions remain explicit and approval-gated. |
| Versioning | Assigned v1.1.1 to the reconciled draft. | Avoids two different artifacts being treated as the same authoritative v1.1.0. |

## Requirement ID treatment

- Existing IDs from both candidate SRS documents are retained with their existing meaning.
- The new IDs `SYNC-015`–`SYNC-020`, `PRV-012`–`PRV-016`, and `NFR-REL-007`–`NFR-REL-010` remain distinct additive requirements because they specify additional observable behaviors.
- `TEST-009`–`TEST-012` are verification scenario IDs and are not product requirements.
- Existing uploaded-candidate IDs `REQ-GOV-001`–`REQ-GOV-006`, `DATA-011`–`DATA-016`, `IF-AUTO-006`–`IF-AUTO-010`, `NFR-AC-001`–`NFR-AC-005`, and `ARCH-016` remain in the main SRS.
- No requirement ID is silently reassigned. The CSV contains one row per unique requirement ID; similar requirements are cross-referenced in the main SRS rather than assumed to be identical.

## Explicitly unresolved

This merge does not approve Phase 1 metric/source scope, retention/deletion policy, export format, local encryption/key management, authentication/session design, supported platform matrix, hosting topology, RPO/RTO, numeric performance/accessibility/security targets, or AI/ML provider terms. See OD-01–OD-22.

The authoritative PRD is still needed to complete PRD-to-SRS traceability. The traceability matrix contains planned verification records; it does not assert that tests have run or passed.
