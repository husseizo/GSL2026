# Purchase Reconciliation

**Not implemented in this pass** — reported honestly rather than fabricated.

## What was profiled but not imported

- `NeonAutoHubPurchaseOrders`/`NeonAutoHubPurchaseOrderLines` (Parts_Catalog) — 195 real purchase order headers, real date range 2024-08-05 to 2026-05-22 (see [parts-catalog-autohub-profile.md](../data-sources/parts-catalog-autohub-profile.md)).
- `MolasCacheDb` has no dedicated purchase-order table in its real schema (see [molas-cache-db-profile.md](../data-sources/molas-cache-db-profile.md)) — only sales-side documents.
- `NeonAutoHubGoodsReceipts`/`NeonAutoHubGoodsReceiptLines` exist in the schema but reported 0/approximate-unknown rows during profiling — not confirmed populated.

## Why this was deferred rather than attempted

The existing `PurchaseDocument` model (Phase 2) already has the right shape (supplier, item, quantity, ordered/expected/receipt dates, unit cost, open/received quantity, status) and its own `SupplierExternalReference` for multi-source identity — no schema work is needed to import into it. What's missing is supplier-side matching (`SupplierMatchingService`, not yet built — no supplier master data has been profiled or imported from either real source yet) and confirmation of the real column mapping for `NeonAutoHubPurchaseOrderLines` (not yet deep-profiled to the same column-name-and-null-rate level of detail as the tables actually imported this pass). Given the very small real row count (195 orders), this is a good candidate for the next controlled batch, following the same staging → match → import → reconcile pattern already proven for sales orders and parts.

## What this phase did establish

The full pipeline machinery (`StagingService`, `ImportService` pattern, `ReconciliationService`, `ManualReviewService`) is generic across entity types — adding `importAutoHubPurchaseOrders()` following the exact same shape as `importAutoHubSalesOrders()` (see `src/data-consolidation/import.service.ts`) is the concrete next step, not a redesign.
