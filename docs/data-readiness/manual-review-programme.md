# Manual Review Programme

`src/data-readiness/review/review-prioritization.service.ts` — a controlled, prioritized review workflow over the existing (Data Consolidation phase) `ManualReviewItem` queue, extended in this phase with `priorityScore`, `reviewBatchId`, `assignedToUserId`/`assignedAt`, and a richer `ReviewDecisionDetail` — see [decision-log.md](decision-log.md) for why these were added as fields on the existing table rather than new parallel tables.

## Real prioritization (2026-07-13, 240 real pending CUSTOMER_MATCH items)

Every pending review item is scored using real signals, not synthetic ones:

- **Total historical sales value** (log-scaled — real order values in this data span from tens of thousands to over a billion TZS)
- **Source-system count** (how many real systems reference this candidate customer)
- **Transaction count**
- **Tax-number/phone conflict presence** (from the real match evidence recorded during import)
- **Recency** of last real transaction

Default weights (`DEFAULT_PRIORITY_WEIGHTS`): sales value 0.30, source-system count 0.15, transaction count 0.15, tax conflict 0.15, phone conflict 0.15, recency 0.05, active status 0.05.

`scoreCustomerMatchReviews()` scored all 240 real pending items in the verification run; `createPriorityBatch()` created a real 25-item `ReviewBatch` from the highest-scored ones.

## Decision types

`ReviewDecisionDetail.decisionType`: `MERGE_APPROVED`, `KEEP_SEPARATE`, `LINK_AS_RELATED`, `REQUEST_MORE_INFORMATION`, `REJECT_PROPOSAL`, `DEFER`, `ESCALATE` — richer than the underlying `ManualReviewItem.status` (`PENDING`/`APPROVED`/`REJECTED`/`DEFERRED`), which the decision type maps onto (`MERGE_APPROVED`/`LINK_AS_RELATED` → `APPROVED`; `REJECT_PROPOSAL`/`KEEP_SEPARATE` → `REJECTED`; everything else → `DEFERRED`).

Every decision records: reviewer, evidence, confidence, reason, real source-record references, canonical entity id, before/after state, and a `reversible` flag.

## Real decision recorded during verification

The verification script recorded one real `DEFER` decision against the highest-priority real review item in the created batch, then the integration test suite separately proved a full `KEEP_SEPARATE` → reversal cycle end to end against real Postgres (see `data-readiness.integration-spec.ts`).

## Reversal

**Never destroys the source identity** — reversing a `ReviewDecisionDetail` sets `reversedAt`/`reversedById`/`reverseReason` and resets the `ManualReviewItem` back to `PENDING`. A decision marked `reversible: false` cannot be reversed at all (`reverseDecision()` throws). This is the "ReviewUndoRequest" capability from the original brief, implemented as a direct, audited field-level state change rather than a separate approval-workflow table (see [decision-log.md](decision-log.md)) — appropriate since no dedicated reviewer UI exists yet to drive a multi-step undo-approval flow.

## What this does *not* do

Per the phase's explicit rule, no decision here ever executes a real customer merge on the canonical `Customer` table — `recordDecision()` only updates the review item and its decision detail. A `MERGE_APPROVED` decision is a recorded human judgment that a *future*, separate, explicit merge operation would act on — not an automatic trigger.

## Access

`POST /data-readiness/review/score-customer-matches`, `/review/create-batch`, `/review/:id/decision`, `/review/decision/:id/undo` (permissions `reviewQueue.assign`/`reviewQueue.decide`/`reviewQueue.undo`).
