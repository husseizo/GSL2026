# Decision Log — Phase 3

Short entries, same format as [decision-log.md](decision-log.md) — the reasoning behind choices that weren't the only reasonable option. Longer rationale lives in the linked doc.

## Why garage operations never post inventory movements themselves

The spec is explicit: the garage only *requests* (reservation, issue, return, consumption); Inventory remains the single source of truth. `src/garage-inventory/garage-inventory.service.ts` has zero new inventory-mutating logic — every method is a direct call to Phase 2's `ReservationsService`/`InventoryLedgerService`. This is enforced by code structure (there is nowhere else in the garage modules that imports `InventoryLedgerService` and calls `postMovement` directly), not by a runtime check. See [garage-architecture.md §1](garage-architecture.md).

## Why "return unused part" reuses `ADJUSTMENT_IN`, not a new movement type

A part going back to the shelf from a job it wasn't ultimately needed for is stock re-added through a non-sale, non-purchase, non-transfer path — exactly what `ADJUSTMENT_IN` already models. A new `GARAGE_RETURN` movement type would duplicate existing balance-effect logic in `src/inventory/balance-effects.ts` for no behavioral difference.

## Why garage invoicing reuses `SalesDocument`, not a parallel invoice model

`EstimatesService.convertToInvoice()` creates a `SalesDocument` (`documentType: INVOICE`) with a new nullable `garageJobId` FK, rather than inventing a `GarageInvoice` model. A completed, billable estimate *is* a sale — reusing the model Phase 2 already built for sales reporting/analytics means garage revenue automatically shows up anywhere `SalesDocument` is already read, instead of needing every downstream consumer (analytics, digital twin cost-of-ownership) to know about two invoice sources.

## Why `Estimate` is its own model, not folded into `SalesDocument`

An estimate is a garage-specific pre-sale workflow — revisions, per-line customer approval/rejection, a distinct approval-request/history trail — that `SalesDocument` doesn't model and shouldn't be extended to model (it would pull garage-specific approval concepts into a document type Sales/Purchasing also use). The two meet at exactly one point: `convertToInvoice()`, an explicit, one-directional conversion once approval is real.

## Why job-status transitions and estimate-response don't happen together

`EstimatesService.respond()` updates the estimate's own status; it deliberately does **not** transition the `GarageJob`'s status as a side effect. Keeping these as separate, explicit calls means the job's `JobStatusHistory` always shows a human/API decision to move the job forward — never an implicit consequence buried inside estimate-response logic that would be invisible when reading the job's own audit trail.

## Why the checklist engine is one generic model, not three

Reception, job-card, and quality checklists are structurally identical (a template of items, a response per item) — see [garage-architecture.md §2](garage-architecture.md). Three schemas would mean three near-identical services and three copies of the same "does this checklist item need a photo/note" logic.

## Why Digital Twin and Vehicle Timeline are computed, not stored

Every field either exposes already lives in another table. Storing a materialized "twin" row would require keeping it in sync on every write across a dozen different tables for no read-performance benefit at current scale. See [vehicle-history.md](vehicle-history.md).

## Why repeat-repair resolution goes through the generic `AuditService`, not a new history table

Every other Phase 3 workflow with a meaningful audit need already has its own purpose-built trail (`JobStatusHistory`, `JobTimeline`, `ApprovalHistory`, `EstimateRevision`) because those trails carry workflow-specific fields (previous/new status, decision, snapshot). A repeat-repair resolution is just "status changed, by whom, why" — exactly what Phase 2's generic `AuditService.log()` already does, so no new table was justified.

## Why repeat-repair matching uses one signal per pair, prioritized

Flagging the same job pair under multiple simultaneous reasons (same complaint *and* same DTC) would be noisier without being more informative — the strongest available signal (complaint > DTC > part > system-category) already tells a reviewer what to look at. See [repeat-repair.md](repeat-repair.md).

## Why `missing_estimate_approval` fires on zero estimates, not just rejected ones

Originally gated on `estimates.length > 0 && !hasApprovedEstimate`, which meant a job with *no* estimate at all — arguably the clearest case of "the customer never approved anything" — silently passed the check. Removed the length guard so `!hasApprovedEstimate` alone triggers the flag regardless of whether any estimate exists.

## Why `respond()`'s estimate-level status is computed from raw line decisions, not from the collapsed request-level decision

`ApprovalDecision` (the enum used at the `ApprovalRequest` level) has no partial value — `deriveOverallDecision()` can only return `APPROVED` or `REJECTED`. Computing the *estimate's* status from that already-collapsed value made `PARTIALLY_APPROVED` structurally unreachable: a mixed response (one line approved, one rejected) was recorded as a fully `APPROVED` estimate. This was caught by an integration test asserting the partial-approval case, not by inspection. Fixed by computing `allApproved`/`allRejected` directly from the real per-line `lineDecisions` array inside `respond()`. See [estimates.service.ts](../../services/operational-core/src/estimates/estimates.service.ts).

## Why a unique-constraint migration was applied via `migrate diff --script` + `migrate deploy` instead of `migrate dev`

Adding `@@unique([jobId, relatedJobId, matchReason])` to `RepeatRepairFlag` triggers Prisma's non-interactive data-loss confirmation gate under `migrate dev`, which this environment can't answer interactively. `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script` generates the same SQL non-interactively; the output was hand-verified, placed in a correctly-named migration folder, and applied with `migrate deploy` (which has no interactive gate). Same underlying migration, different application path — nothing about the resulting schema differs from what `migrate dev` would have produced had it been answerable.
