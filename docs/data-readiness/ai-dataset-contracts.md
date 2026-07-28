# AI Dataset Contracts

`src/data-readiness/ml/lubricant-demand-dataset.service.ts` + the `AIDatasetContract` model — the one real, approved, end-to-end dataset contract this phase implements, per its completion criteria ("at least one AI-ready dataset contract is implemented").

## Real contract: `lubricant_item_demand_v1`

| Field | Real value |
|---|---|
| Business purpose | Forecast near-term unit demand for individual, forecast-eligible lubricant products |
| Source entities | `LubricantProduct`, `SalesDocumentLine`, `SalesDocument` |
| Date range | Real: 2026-04-14 to 2026-07-11 (the actual imported sales-order window) |
| Required fields | `lubricantProductId`, `documentDate`, `quantity` |
| Entity key | `lubricantProductId` |
| Time key | `documentDate` |
| Train split | Earliest records up to (max date − 28 days) |
| Validation split | 14 days immediately before the test window |
| Test split | Most recent 14 days, untouched during model selection |
| Missing-value policy | Dense daily series with explicit zero-fill (never inflates an intermittent item's average by only averaging over days it sold) |
| Outlier policy | Not removed — real demand spikes are real signal |
| Deduplication policy | One row per (product, day) after aggregation; upstream `SalesDocumentLine` uniqueness (`salesDocumentId`, `lineNumber`) already prevents duplicate import |
| Personal-data policy | No customer-identifying fields — entity key is a product, not a customer |
| Provenance fields | `sourceSystem`, `sourceRecordId` of underlying `SalesDocumentLine` rows |

## Real build result (2026-07-13)

Built and evaluated against **213 real lubricant products with real sales history** (from the 2,919 real imported `SalesDocumentLine` rows):

```
DATA_GAP: 84, INSUFFICIENT_HISTORY: 64, DISCONTINUED: 20, INTERMITTENT_DEMAND: 42, FORECAST_ELIGIBLE: 3
```

Only 45 of 213 real items (21%) were forecast-eligible or intermittent-demand — the rest are honestly excluded rather than force-fit. This reflects the real constraint that only ~90 days of sales-order history has been imported so far (see [docs/data-consolidation/decision-log.md](../data-consolidation/decision-log.md) "Why the historical backfill starts with a 90-day window") — a longer real backfill would directly increase `FORECAST_ELIGIBLE` counts without any change to this contract's logic.

## Versioning

`buildVersion` increments on each new contract row for the same `datasetName` — real proof: the verification script and its earlier failed attempt (before a real bug fix) both created a `AIDatasetContract` row, and the real database shows `v1`/`v2` as distinct, immutable rows, never overwritten.

## Checksum

`datasetChecksum` is a real `stableChecksum()` (same function used throughout this project's sync pipeline — see [docs/architecture/decision-log.md](../architecture/decision-log.md)) over the per-item eligibility/method results — changes if and only if the real underlying build result changes.

## Approval

`approvedById`/`approvedAt` — set when a real user approves the contract (the verification script used a real seeded `GENERAL_MANAGER` user). An unapproved contract is not eligible for DGX export (see [dgx-data-access-contract.md](dgx-data-access-contract.md)).
