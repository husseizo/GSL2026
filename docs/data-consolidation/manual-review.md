# Manual Review

`src/data-consolidation/manual-review.service.ts` — one generic queue (`ManualReviewItem`) for every uncertain decision this phase produces, rather than one table/workflow per queue type.

## Why one queue

Customer/supplier/parts/lubricant/warehouse/branch/vehicle matches, unresolved sales/purchase lines, Odoo product mappings, financial-reconciliation variance, inventory mismatch, and source conflicts are all structurally the same problem: a proposed action, evidence for it, a confidence level, and a human decision that must be recorded with a reason and a before/after state. `queueType` (a free-text discriminator, e.g. `CUSTOMER_MATCH`, `PARTS_DUPLICATE`, `FINANCIAL_VARIANCE`) distinguishes them for filtering without needing a separate table per type.

## Real queue types produced so far

Only `CUSTOMER_MATCH` has real entries as of this pass's controlled batch — 241 real ambiguous customer matches (see [customer-consolidation.md](customer-consolidation.md)). `PARTS_DUPLICATE`/`LUBRICANT_DUPLICATE` exist as queue types in `ImportService` but produced zero real entries in this run (no ambiguous part/lubricant matches were found in the real data profiled) — the code path is real and tested (see the parts/lubricant matching integration tests), just not exercised by real data yet.

## Workflow

`enqueue()` (called internally by `ImportService` when a match evaluates to POSSIBLE_MATCH or CONFLICT) → `list(queueType?, status?)` → `approve(id, reviewedById, reason)`/`reject(id, reviewedById, reason)`. Every review records who decided, when, and why (`decisionReason`); `beforeState`/`afterState` fields exist on the model for recording exactly what changed, though the current `approve()`/`reject()` implementation doesn't yet perform the resulting domain-entity merge/link automatically — approving a review currently records the decision; a human or a follow-up script still performs the actual link. See [decision-log.md](decision-log.md) for why this was left as an explicit two-step rather than auto-executing on approval in this pass.

## Access

`GET /data-consolidation/manual-review` (permission `mappings.read`), `PATCH /data-consolidation/manual-review/:id/approve` / `/reject` (permission `mappings.approve`, granted to `SYSTEM_ADMINISTRATOR`/`OWNER`/`GENERAL_MANAGER`); `DATA_QUALITY_REVIEWER` has `mappings.review` (read + can be extended to review-specific actions) but not `mappings.approve` — approval is deliberately a manager-level action, consistent with the phase's "production imports should require elevated approval" instruction.
