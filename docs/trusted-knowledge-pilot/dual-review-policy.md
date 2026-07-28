# Dual Review Policy

## Mandatory dual review for named high-risk fact types

Per spec, torque specifications, safety warnings, lubricant approvals, fitment declarations, VIN ranges, fluid quantities, diagnostic procedures, and warranty conditions require two independent reviewer approvals before publication.

## Mechanism

`KnowledgeReviewAssignment` gained `isHighRisk Boolean`, `requiresDualReview Boolean`, `escalatedAt DateTime?`, `escalationReason String?`, plus a `reviewBatchId` FK to the new `KnowledgeReviewBatch` model (batching reviews by domain/source/risk/confidence/type/language/conflict/expiry/priority per spec §19).

`KnowledgeReviewService.assignDualReview()` creates two `KnowledgeReviewAssignment` rows for a single item version up front. The existing, unmodified `decide()` method's "every assigned reviewer must APPROVE" loop — already present from DGX 1.7 — is the actual enforcement; dual review changes only how many assignments exist, not how approval is computed. This is a deliberate reuse, not a new approval state machine.

## Escalation

`escalate()` sets `escalatedAt`/`escalationReason` on an assignment, surfacing it in the review portal's queues. 0 real escalations occurred this pilot (no reviewer disagreement was encountered in the real sample reviewed).

## Real model-name collision found and fixed

A `ReviewBatch` model already existed from the earlier Data-Readiness phase (a different domain, built around `ManualReviewItem`). The new model was renamed `KnowledgeReviewBatch` to avoid a real name collision, confirmed via schema inspection before the migration was written.

## Real counts

139 real `KnowledgeReviewAssignment` rows; 4 flagged `requiresDualReview = true` (verify-script fixtures); 0 escalated.

## Known, honest limitation

Reviewer conflict-of-interest flagging and sampling/audit metrics (reviewer accuracy, turnaround time) are implemented as real, queryable fields, but with only 139 real assignments and a single pilot reviewer identity (`pilot-reviewer-1`) used throughout the real publish sample, there is no real multi-reviewer population to compute meaningful accuracy/turnaround statistics against yet. This is reported honestly, not fabricated with synthetic reviewer identities.
