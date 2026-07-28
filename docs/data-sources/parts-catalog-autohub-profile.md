# Source Profile — Parts_Catalog (Neon Postgres) — Spare Parts, VIN Catalog, "AutoHub"

**Real, live cloud Postgres database (Neon), profiled read-only on 2026-07-12.** Not named in the original phase brief (which expected spare-parts data in `MOLAS_Live_2021_Cache`) — real profiling found `MOLAS_Live_2021_Cache` almost empty (see [molas-live-2021-cache-profile.md](molas-live-2021-cache-profile.md)) and this database populated instead. Per explicit user direction, **this is the real spare-parts source of truth** for this phase.

## Connection

- Neon-hosted PostgreSQL, `sslmode=require`, real pooled connection string in `.env` as `NEON_PARTS_CATALOG_DATABASE_URL`.
- 76 tables total across `public` and a `demand` schema. Three distinct provenance patterns are visible in the schema itself:
  1. **`oitm*` / `tecdoc_*` tables** — snake_case naming, Python/Django-style timestamps (`create_date`, `write_date`) — a parts-catalog enrichment pipeline matching SAP's item master (`oitm` ≈ SAP B1's `OITM` table) against a licensed **TecDoc** automotive parts-fitment dataset.
  2. **`NeonAutoHub*` tables** — PascalCase, `U_`-prefixed columns (classic SAP B1 user-defined-field naming), its own `__EFMigrationsHistory_AutoHub` — a separate, already-existing .NET/EF Core application ("AutoHub") that already syncs real SAP B1 commercial documents into this database.
  3. **`demand` schema** and dated backup tables (`*_backup_2026062*`) — prior forecasting/data-cleanup work by others. **Out of scope this phase** (explicit decision — see [decision-log.md](../data-consolidation/decision-log.md)).

## Tables relevant to consolidation

### Commercial documents (`NeonAutoHub*` — real SAP B1 sync, via AutoHub)

| Table | PK | Real row count | Date range (`DocDate`) |
|---|---|---|---|
| `NeonAutoHubSalesOrders` | `DocEntry` | 15,785 | 2024-06-03 → 2026-07-12 (today) |
| `NeonAutoHubSalesOrderLines` | (FK `DocEntry`) | 26,622 | |
| `NeonAutoHubInvoices` | `DocEntry` | 14,391 | **2023-11-08** → 2026-07-10 (~2.7 years) |
| `NeonAutoHubInvoiceLines` | (FK `DocEntry`) | 26,001 | |
| `NeonAutoHubDeliveries` | `DocEntry` | 16,419 | 2024-06-30 → 2026-07-11 |
| `NeonAutoHubDeliveryLines` | (FK `DocEntry`) | 30,371 | |
| `NeonAutoHubPurchaseOrders` | `DocEntry` | 195 | 2024-08-05 → 2026-05-22 (much lower volume than sales — expected for a distributor) |
| `NeonAutoHubPurchaseOrderLines` | (FK `DocEntry`) | 5,841 | |
| `NeonAutoHubStockTransfers` | `DocEntry` | 2,398 | 2024-07-01 → 2026-07-10 |
| `NeonAutoHubStockTransferLines` | (FK `DocEntry`) | 8,190 | |
| `NeonAutoHubGoodsReceipts(Lines)`, `NeonAutoHubInventoryCountings(Lines)`, `NeonAutoHubSalesPersons`, `NeonAutoHubUoMs` | — | 0 (unanalyzed/new) | Schema exists; not yet populated or never analyzed — re-check before assuming empty |
| `NeonAutoHubProducts` | `ItemCode` | 9,933 | `SyncedAt` — **every row shares the identical timestamp** (a full-table-refresh sync pattern, not incremental — different from the header tables above, which show real historical spread) |

Real sample (`NeonAutoHubSalesOrders`, masked): `DocEntry=10954, CardCode="0001", CardName="C**H", DocDate=2024-06-03, DocStatus="C", DocTotal=1000000.00`. `CardCode="0001"` recurs — likely a generic/walk-in customer code, not a real individual party; flag for the customer-matching rules (don't treat "0001" as a real party to consolidate).

### Item master & vehicle fitment (`oitm*` / `tecdoc_*`)

| Table | Real row count | Notes |
|---|---|---|
| `oitm` | 9,154 | Enriched item master. `item_code` 3.45% null, `canonical_oem_number` 3.41% null, `item_code` has 316 duplicate values (not a clean unique key alone). Real sample: article `7PK1635` ("V-Ribbed Belt", TOP DRIVE), `sell_price_tzs=70000.00`, `part_group="Engine"`/`part_group_confidence="high"`, `enrichment_confidence=90`. Many enrichment-pipeline "pass_N_*" columns (`pass_3_*`, `pass_4_*`) recording iterative automated cleanup — real, ongoing enrichment process, not a one-shot import. |
| `oitm_cross_reference` | 3,704,665 | OEM cross-reference numbers per item — real and very large. |
| `oitm_compatible_vehicle` | 1,363,240 | Item-to-vehicle fitment links. |
| `oitm_specification`, `oitm_article_criteria`, `oitm_extracted_oems`, `oitm_category`, `oitm_related_parts`, `oitm_factory_codes` | 36,948 / 36,731 / 23,402 / 26,952 / 7,626 / 726 | Supporting enrichment detail. |
| `tecdoc_vehicle` | 17,338 | PK `tecdoc_id`. Created 2026-03-09 (one bulk import, not incremental). |
| `tecdoc_article` | 15,723 | PK `tecdoc_article_id`. |
| `tecdoc_vehicle_category_article`, `tecdoc_article_vehicle` | 8,554,791 / 3,378,514 | The bulk of TecDoc's fitment graph — very large, licensed reference data, not company-authored. |
| `neon_germax_products` | 1,075 | Germax-brand spare parts — same brand as `CacheGermaxProducts` (1,177 rows) in `MOLAS_Live_2021_Cache`; likely two ends of an existing brand-specific sync, not yet cross-reconciled. |

### VIN decoding

| Table | Real row count | Notes |
|---|---|---|
| `vin_decoded` | 12,405 (11,814 approx from stats, 12,405 exact) | PK-like unique `vin` (0 duplicates). `decoded_at` range is **a two-hour window on 2026-05-19** — a single bulk decode batch, not continuous. `manufacturer_name` is 56.16% NULL — over half of decoded VINs have no resolved manufacturer. Real sample: a fully-decoded BMW X3 (2009, E83, N47 engine) with complete PR-code and equipment-code JSON — rich real vehicle-option data when decoding succeeds. |
| `vin_batch_vin`, `vin_upload_batch` | 12,409 / 3 | Batch tracking for the VIN decode runs above. |

## Real data-quality findings

- `oitm.item_code` is not a clean unique key (316 duplicate values across 9,154 rows) — matching logic must account for this, not assume 1:1.
- Roughly half of decoded VINs (`vin_decoded`) have no manufacturer resolved — Digital Twin population from VIN alone will have real, material gaps.
- `NeonAutoHubProducts` appears to undergo full-table-refresh syncs (identical `SyncedAt` across all rows) while the document header tables (`SalesOrders`, `Invoices`, etc.) show genuine incremental history — these two tables' sync semantics are different and any adapter must not assume one cursoring strategy fits both.
- Several tables report `-1` in the fast/approximate row-count scan (`reltuples` never computed by `ANALYZE`) — treat as "unknown, re-check with an exact count," not "zero rows."
- Dated backup tables (`_backup_20260618`, `_backup_20260621_*`) indicate other, recent, real cleanup work directly against this production database by someone else — a live-editing environment, not a frozen snapshot.

## Candidate business keys

- Item: `oitm.item_code` — not unique alone; needs disambiguation (likely combined with `supplier_id` or `article_number`).
- Vehicle fitment / TecDoc: `tecdoc_id` / `tecdoc_article_id` (both confirmed unique).
- Commercial document header: `DocEntry` (confirmed unique per `NeonAutoHub*` table).
- VIN: `vin` (confirmed unique, 12,405 rows).

## Known anomalies / risks

- This database was not the one named in the original brief — it was discovered during profiling, not assumed. Re-profile periodically; its schema is evidently still actively evolving (recent backup tables, in-progress enrichment "passes").
- No write access needed or used here — same `sslmode=require`, read-only application-level discipline as every other source (see [source-data-risks.md](source-data-risks.md)).
