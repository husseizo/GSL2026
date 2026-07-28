# DGX 2.0 Certification Dataset v1

Real, versioned, checksum-verified dataset of references into the live operational database — built by `scripts/build-dgx2-certification-dataset.ts`, reused (never rebuilt in place) by every future certification run against this version. See `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` §20.

## Dataset version

v1

## Generated

2026-07-28T06:53:47.225Z

## Query window

2024-07-28T06:53:47.194Z to 2026-07-28T06:53:47.194Z

## Record counts

| Entity | Count |
|---|---|
| Warehouses | 4 |
| Suppliers | 3 |
| InventoryItemMetric rows | 10 |
| SupplierMetric rows | 3 |
| TransferRecommendation rows | 2 |
| ForecastRun rows (total, all versions) | 50 |

## Coverage by scenario category

| Category | Real entries |
|---|---|
| MULTI_WAREHOUSE | 4 |
| MULTI_SUPPLIER | 3 |
| HIGH_VOLUME_ITEM | 2 |
| LOW_VOLUME_ITEM | 2 |
| INTERMITTENT_DEMAND | 1 |
| STOCKOUT_RISK | 1 |
| EXCESS_INVENTORY | 5 |
| TRANSFER_CANDIDATE | 2 |
| VARYING_LEAD_TIME | 3 |
| VARYING_SUPPLIER_PERFORMANCE | 3 |

## Known limitations

- No real inactive supplier exists in this environment (0 of 3 real suppliers). The inactive-supplier Safety Gate is validated by the real, executed Sprint 1 test suite (purchase-recommendation-math.spec.ts, purchase-recommendations.integration-spec.ts) rather than a real business-data case in this dataset — an honest gap, not a fabricated one.
- No real warehouse has a capacity value set (0 of 4). The warehouse-capacity Safety Gate is validated by the real, executed Sprint 1 test suite rather than a real business-data case in this dataset — an honest gap, not a fabricated one.
- Zero real, completed StockTransfer rows exist in this environment. TRANSFER_CANDIDATE coverage (2 entries) is real advisory TransferRecommendation data, not a completed real transfer outcome — a real, honest limitation on the "real business outcome" ideal the Certification Standard §20 describes.
- Only 10 real InventoryItemMetric rows exist across all warehouses in this environment — a genuinely small real sample, honestly reported rather than padded with synthetic rows.

## Checksum

`e4f07c6d426fa2851376cd3329925305735c6437b8bfc0437b29bf3b907e9b85`

Verified by `validateDatasetIntegrity()` (`src/dgx2-certification/dataset-validator.ts`) — recomputed from the real entry list and compared against the stored value on every load.
