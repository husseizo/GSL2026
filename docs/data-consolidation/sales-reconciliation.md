# Sales Reconciliation

`src/data-consolidation/reconciliation.service.ts` — real per-batch counts and Decimal-accurate financial totals, written to `ReconciliationReport`.

## What's reconciled

Per batch, per entity type: source count, extracted count, staged count, valid count, imported count, updated count, duplicate count, dead-letter count, manual-review count, skipped count, target count, and the variance between source and target counts. For financial documents, also: source/target subtotal, tax, discount, total, and the difference — computed with Prisma's `Decimal` type throughout (`Prisma.Decimal.minus()`), never `Number`/floating point, per the phase's explicit rule.

## What's imported this pass

Only `SALES_ORDER` documents, from both real sources, bounded to the last 90 days (see [decision-log.md](decision-log.md) "Why the historical backfill starts with a 90-day window"):

- `MOLAS_CACHE_LUBRICANTS_SALES_HEADERS` (`CacheSalesOrders`) — 1,640 real orders.
- `PARTS_CATALOG_AUTOHUB_SALES_HEADERS` (`NeonAutoHubSalesOrders`) — 1,758 real orders.

`SalesDocument` (Phase 2, unchanged) already has `sourceSystem`/`sourceRecordId` and its own `SalesExternalReference` back-relation — no schema change was needed to import into it.

## Real reconciliation result (2026-07-12, lubricants sales orders, last 90 days)

```
sourceCount=1640  targetCount=1640  variance=0
sourceTotal=1217676208.36  targetTotal=1217676208.36  difference=0
```

Over 1.2 billion TZS reconciled to the cent, using real `Decimal` arithmetic against 1,640 real sales orders.

## Document types not yet imported

`CacheInvoices`/`CacheInvoiceLines`, `CacheDeliveries`/`CacheDeliveryLines`, `CachePayment` (lubricants) and `NeonAutoHubInvoices`/`NeonAutoHubDeliveries` (spare parts) were profiled (see the `docs/data-sources/*.md` profiles) but not imported in this pass. Per the phase's explicit rule against double-counting commercial activity when a source includes multiple related document types (order → delivery → invoice → payment for the same real transaction), which document type "drives" revenue/demand/inventory-issue/customer-history/margin/sales-velocity needs an explicit decision before invoices and deliveries are imported alongside sales orders — not assumed. This pass established the pipeline and imported the header-level demand signal (`SALES_ORDER`) only.

## Customer resolution

Lubricants sales orders resolve `customerId` via the `CustomerExternalReference` created during customer import (see [customer-consolidation.md](customer-consolidation.md)) — 100% resolved in the real run since customers were imported first, in the documented order. AutoHub sales orders preserve `unresolvedCustomerRef = CardCode` — AutoHub has no dedicated customer-master table (see [parts-consolidation.md](parts-consolidation.md) and [parts-catalog-autohub-profile.md](../data-sources/parts-catalog-autohub-profile.md)), so customer identity for spare-parts sales is deferred rather than fabricated from a document header alone.
