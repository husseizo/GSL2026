# Baseline Metrics Catalogue

The full, real catalogue of metrics this phase implemented, each with its formula and real confidence — see [business-baseline-framework.md](business-baseline-framework.md) for the framework these run under.

## Customer

| Metric | Formula | Real confidence |
|---|---|---|
| `active_customers` | `count(Customer WHERE isActive)` | HIGH |
| `total_customers` | `count(Customer)` | HIGH |
| `repeat_customer_rate` | `count(customers with >1 SalesDocument) / count(customers with >=1)` | HIGH |
| `customers_inactive_30d`/`60d`/`90d`/`180d`/`365d` | `count(Customer WHERE isActive AND no SalesDocument in window)` | HIGH |

## Sales

| Metric | Formula | Real confidence |
|---|---|---|
| `total_sales_order_value` | `SUM(SalesDocument.grandTotal)` in range | HIGH |
| `sales_order_count` | `COUNT(*)` in range | HIGH |
| `average_order_value` | `SUM(grandTotal) / COUNT(*)` | HIGH (LOW if zero orders) |
| `median_order_value` | `MEDIAN(grandTotal)` | HIGH (LOW if zero orders) |
| `cancelled_order_rate` | `count(CANCELLED) / count(*)` | HIGH |
| `open_order_rate` | `count(OPEN) / count(*)` | HIGH |

## Data pipeline

| Metric | Formula | Real confidence |
|---|---|---|
| `import_success_rate` | `count(RawSourceRecord WHERE processingStatus=IMPORTED) / count(*)` | HIGH |
| `manual_review_rate` | `count(MANUAL_REVIEW) / count(*)` | HIGH |
| `open_dead_letter_count` | `count(SyncDeadLetter WHERE resolvedAt IS NULL)` | HIGH |

## Inventory — explicitly NOT_READY

`inventory_readiness_lubricants`, `inventory_readiness_spare_parts` — value `0`, confidence `NOT_READY`, evidence citing the real recommended strategy (`STRATEGY_B_OPENING_BALANCE` for both) and rationale from [inventory-readiness.md](inventory-readiness.md). Reported as metrics precisely so their NOT_READY status is visible in the same catalogue as everything else, not silently omitted.

## Garage — explicitly NOT_AVAILABLE

`workshop_turnaround_time`, `technician_productivity`, `repeat_repair_rate` — value `0`, confidence `NOT_AVAILABLE`. No real garage/Odoo operational data exists to compute these from (see [docs/data-sources/odoo-garage-profile.md](../data-sources/odoo-garage-profile.md)).

## Deliberately not yet implemented

Per-branch/warehouse segmentation (blocked on [branch-warehouse-mapping.md](branch-warehouse-mapping.md)'s `UNMAPPED` status), supplier/purchase KPIs (no supplier data imported), parts fast/slow/non-moving classification (needs a longer real sales history than the 90-day window currently imported), lubricant-specific KPIs beyond what's covered by the demand-forecasting dataset (see [forecast-baselines.md](forecast-baselines.md)). None of these were silently skipped — each has a real, specific blocking reason recorded in [decision-log.md](decision-log.md).
