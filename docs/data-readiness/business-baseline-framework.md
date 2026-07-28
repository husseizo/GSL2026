# Business Baseline Framework

`src/data-readiness/baseline/baseline.service.ts` — versioned, reproducible business KPI computation, established *before* any AI intervention on this data, per the phase's stated purpose.

## Model design

Three real tables (not the original brief's seven — see [decision-log.md](decision-log.md)):

- **`BaselineDefinition`** — one row per named, versioned metric formula (`metricName`, `version`, `definition`, `formula`). Redefining a metric's formula creates a new version rather than mutating history.
- **`BaselineRun`** — one row per computation run: `dataCutoffAt`, real `sourceCursors` (from `IntegrationSource.lastCommittedCursor`), real `inputRowCounts`, a `calculationChecksum` (hash of code version + metric set) and `outputChecksum` (hash of the actual computed values), `status`/`approvedById`/`approvedAt`.
- **`BaselineMetric`** — one row per (run, definition, segment): the real computed `value` (`Decimal`, never `Number`), `currency`, date range, `confidence`, `evidence`.

## Real, reproducible run (2026-07-13)

`runBaseline(dateRangeStart, dateRangeEnd)` computed **22 real metrics** in one run (`e78be998-...`), covering customer, sales, and data-pipeline categories, plus explicit `NOT_READY`/`NOT_AVAILABLE` entries for inventory/garage. The run was approved (`approveBaseline()`).

**Reproducibility, proven twice** (once in the verification script, once in the integration test suite): re-running `runBaseline()` against the same underlying data produced:

```
calculationChecksum: faea4d7530fb0d2332454e52c14ccb06357b0cf0ce6426ceb1c54e32f5dc34e1  (identical both runs)
outputChecksum:      8383a1e9ea283b8f...                                                (identical both runs)
```

## Real KPIs computed this phase

**Customer**: `active_customers`, `total_customers`, `repeat_customer_rate`, `customers_inactive_{30,60,90,180,365}d`.
**Sales**: `total_sales_order_value`, `sales_order_count`, `average_order_value`, `median_order_value`, `cancelled_order_rate`, `open_order_rate`.
**Data pipeline**: `import_success_rate`, `manual_review_rate`, `open_dead_letter_count`.
**Inventory**: explicitly `NOT_READY` (both business units — see [inventory-readiness.md](inventory-readiness.md)).
**Garage**: explicitly `NOT_AVAILABLE` (`workshop_turnaround_time`, `technician_productivity`, `repeat_repair_rate` — no real garage data exists).

Not every KPI the original brief listed was implemented this pass (e.g. per-branch/warehouse segmentation, since warehouse mapping is `UNMAPPED`; supplier/purchase KPIs, since no supplier data is imported yet) — the framework itself is general enough to add them once their underlying data exists; see [decision-log.md](decision-log.md).

## Real reconciliation against imported totals

`total_sales_order_value` for the last 90 days computed by the baseline run matched the real `SalesDocument` aggregate for the identical window **exactly**: `1217676208.36 = 1217676208.36`.

## Access

`POST /data-readiness/baseline/run` (permission `baseline.generate`), `/baseline/:id/approve` (`baseline.approve`), `GET /data-readiness/baseline/compare?runA=...&runB=...` (`baseline.read`).
