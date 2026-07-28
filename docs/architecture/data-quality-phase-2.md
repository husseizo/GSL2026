# Data Quality (Phase 2)

## Severity — the load-bearing distinction

`DataQualitySeverity`: `FATAL` (reject the record — the caller must not proceed), `RECOVERABLE` (proceed, but flag for correction), `WARNING` (proceed, informational), `MANUAL_REVIEW` (proceed, but a human must look at it before it's trusted). Not every quality problem gets the same treatment — the spec explicitly asks that they not all be routed to dead-letter, and this severity field is what makes that distinction real rather than a naming convention.

## Where each of the spec's ~20 checks actually lives

Some are structural (the database itself rejects them, no code needed):
- Duplicate customer/supplier codes → `@unique` constraint on `customerCode`/`supplierCode`.
- Duplicate sales/purchase documents from the same source → `@@unique([sourceSystem, sourceRecordId])`, the same Phase 1 idempotency pattern.
- Missing warehouse/branch mappings on a document → the FK is nullable; an unresolved code doesn't hard-fail, it's the "unresolved reference" case below.

Some are explicit checks recorded via `DataQualityService.record()` (`src/common/data-quality/data-quality.service.ts`), called from the specific import points where they apply:
- **Invalid quantity / negative price** — `checkQuantityAndPrice()`, shared by both the sales and purchase line normalizers, so the two importers can't drift on what "invalid" means.
- **Missing item resolution** — an `item_code` that doesn't match a `Part`/`LubricantProduct` (`missing_item_resolution`, `MANUAL_REVIEW`); the line is still created with `unresolvedItemCode` set and `itemType: UNKNOWN`, per the spec's "preserve unresolved references" principle.
- **Unresolved customer/supplier reference** — same idea, `unresolved_customer_reference`/`unresolved_supplier_reference`.
- **Negative available stock** — `negative_available_stock`, `RECOVERABLE`, raised by `InventoryLedgerService.postMovement()` itself (see [inventory-ledger.md](inventory-ledger.md)).
- **Sales line changed after its inventory movement posted** — `sales_line_changed_after_posting`, `MANUAL_REVIEW` (see [phase-2-commercial-foundation.md §2.4](phase-2-commercial-foundation.md)).

Some are `FATAL` and go to Phase 1's dead-letter store instead of `DataQualityIssue`, because they mean the record structurally can't be processed at all: missing `document_number`/`document_type`/`document_date`, an unrecognized `document_type`, no lines at all, an unparseable `occurredAt` on an app event, an unrecognized `eventType`.

## Deferred, not implemented

A handful of the spec's ~20 checks (impossible receipt-before-order dates, supplier lead time below zero, invalid lubricant package size, missing lubricant approval where one is claimed, inventory movement without a reference, lost-sale candidate with no evidence) are not wired up as explicit checks yet. Most would slot into `DataQualityService` the same way the existing ones do; they were deprioritized in favor of the checks that the verification workflow's sample data actually exercises. Flagged here rather than silently omitted.

## Reviewing issues

`DataQualityService.list()`/`resolve()` — filterable by severity/entity type/resolved status; `resolve()` records who resolved it and when. No UI in Phase 2; this is API-only, consistent with the rest of the phase.
