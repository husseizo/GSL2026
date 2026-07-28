# Commercial Document-Chain Semantics

`src/data-readiness/document-semantics.ts` — a pure, formally-tested module defining which real document type drives which business metric, so a sales order followed by a delivery and invoice for the same real transaction is never counted three times.

## Real document-type discovery (re-confirmed this phase against the actual imported/profiled schemas)

| Source | Document types confirmed to exist | Imported this phase |
|---|---|---|
| `MolasCacheDb` | Sales Order (`CacheSalesOrders`), Invoice (`CacheInvoices`), Delivery (`CacheDeliveries`), Payment (`CachePayment`) | Only Sales Order (header + lines) |
| `Parts_Catalog`/AutoHub | Sales Order, Invoice, Delivery, Purchase Order, Stock Transfer; Goods Receipts/Inventory Countings exist in schema but reported 0/unknown rows during profiling | Only Sales Order (header) |

**No quotation, credit-note, return, or supplier-invoice table was confirmed to exist in either real source.** Neither is assumed to exist.

## Metric → driving document type

```
REVENUE                -> INVOICE            (not yet imported)
INVENTORY_CONSUMPTION  -> DELIVERY            (not yet imported)
SALES_VELOCITY         -> SALES_ORDER         (real data imported this phase)
CUSTOMER_DEMAND        -> SALES_ORDER         (real data imported this phase)
MARGIN                 -> INVOICE             (not yet imported)
PAYMENT_STATUS         -> INVOICE             (not yet imported)
LOST_DEMAND            -> QUOTATION           (no quotation source imported — see odoo-garage-profile.md)
```

## The double-count guard

`selectDocumentsForMetric(chain, metric)` selects only the documents matching the metric's driving type from a real transaction's document chain — never summing across types. `assertNoDoubleCounting()` throws if a chain ever resolves to more than one distinct document type for one metric — a structural guard, not just a convention, verified by `document-semantics.spec.ts`.

**Deliberate fallback, not a shortcut**: `CUSTOMER_DEMAND`/`SALES_VELOCITY` fall back to `SALES_ORDER` if their nominal driver isn't `SALES_ORDER` already (currently a no-op, since both already drive from `SALES_ORDER`). `REVENUE`/`MARGIN`/`PAYMENT_STATUS` **never** fall back to `SALES_ORDER` — an order is not yet revenue, and pretending otherwise would materially misstate the business's real financial position.

## Why this matters right now, even with only one document type imported

Because only `SALES_ORDER` is imported today, there is no live double-counting risk yet in this build's actual `BaselineMetric` computations (see [business-baseline-framework.md](business-baseline-framework.md) — `total_sales_order_value` is explicitly a sales-order metric, not presented as "revenue"). This module exists so that importing `INVOICE`/`DELIVERY` next (see [docs/data-consolidation/sales-reconciliation.md](../data-consolidation/sales-reconciliation.md)) has an already-tested semantic layer to plug into, rather than requiring the metric logic to be designed under time pressure once those document types land.
