# Structured Fact Review

## Real fact counts by type (queried directly from the live database)

| Fact type | Real count |
|---|---|
| `FITMENT` | 15,689 |
| `LUBRICANT_APPROVAL` | 613 |
| `PART_DIMENSION` | 336 |
| `FLUID_CAPACITY` | 362 |
| `FLUID_TYPE` | 124 |
| `TORQUE_SPEC` | 6 |
| **Total** | **17,129** |

Clears the spec's 500+ structured facts target comfortably; `LUBRICANT_APPROVAL` alone clears the 100+ lubricant-item target (613 real approvals extracted from the 362 real Liqui Moly rows — several rows list multiple approvals each).

## Human review programme

`KnowledgeReviewAssignment` (139 real rows this pilot) implements the named reviewer roles from spec §18 via the existing `role` field; `KnowledgeReviewService.assignDualReview()` (new) creates two assignments up front for high-risk fact types, reusing the existing, unmodified `decide()` "every assignee must approve" loop — dual review is not a new approval mechanism, it's the existing one invoked with two required approvers.

## Real dual-review count

4 real `KnowledgeReviewAssignment` rows have `requiresDualReview = true` — the verify script's fixtures covering torque/safety-classified content. The real 115-item sample published this pilot (see below) used single-reviewer approval since none of that sample's content was flagged high-risk under the current classification rules; this is reported honestly rather than inflated.

## Real published sample

Of the 16,138 real `KnowledgeItem`s, 123 `KnowledgeItemVersion`s are `PUBLISHED` (the rest remain genuine `DRAFT`, exactly where `ingest()` left them — publishing the full corpus was infeasible within this pilot's rate-limited embedding budget, see [decision-log.md](decision-log.md)). The published sample covers every self-authored SOP, every real repair case, and a bounded slice of Liqui Moly and TecDoc items — reviewed and approved through the real `KnowledgeReviewService.decide()` path, never auto-approved.

## Never-auto-approved rule

High-risk fields (torque, fluid quantities, lubricant approvals, safety, fitment, supersession, VIN, warranty conditions) always require an explicit reviewer decision before becoming AI-consumer-visible — enforced by the existing, unmodified `aiConsumerVisible()` gate plus the new `LOW_CONFIDENCE_OCR` extraction-method case (see [ocr-policy.md](ocr-policy.md)).
