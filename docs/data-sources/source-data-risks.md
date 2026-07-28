# Cross-Cutting Source Data Risks

Real risks identified during read-only profiling of `MolasCacheDb`, `MOLAS_Live_2021_Cache`, and `Parts_Catalog` on 2026-07-12. See the individual profile documents for source-specific detail.

## 1. The SQL Server credential is `sa` (sysadmin), not a scoped read-only login

The only credential provided for `MolasCacheDb`/`MOLAS_Live_2021_Cache` is the SQL Server `sa` account — full administrative access to the entire instance, every database on it, and the ability to alter permissions themselves. This means:

- The "read-only" guarantee for these two databases is enforced **entirely by application-code discipline** (every query in `MolasLubricantsCacheAdapter`/profiling scripts must be a `SELECT`), not by the database.
- **Recommendation, not yet actioned**: ask a DBA to create a dedicated login with `db_datareader` on exactly `MolasCacheDb` and `MOLAS_Live_2021_Cache` and nothing else, and retire the use of `sa` for this integration once that exists.
- Until then, any code touching this connection must be reviewed with extra care — a single accidental `UPDATE`/`DELETE`/DDL statement would have full-instance blast radius.

## 2. Real production data, not a snapshot

Every source profiled is live and actively changing: `MolasCacheDb.CacheInvoices.DocDate` extends to the day this profiling ran; `Parts_Catalog` has dated backup tables from cleanup work performed by others as recently as 2026-06-21. This is not a frozen test fixture — profiling numbers in these docs will drift, and any adapter built against them must re-validate assumptions periodically, not treat a profile document as permanently authoritative.

## 3. Uneven SAP↔Odoo sync-field population (`MolasCacheDb`)

`OdooCustomerId` (100% null on customers), `OdooDeliveryId` (100% null), `OdooPaymentId` (85.2% null) cannot be relied on as a complete cross-system identity map. Only `OdooProductId` is fully populated. Any customer/product/document matching logic that assumes "if `OdooXId` is set, we have a confirmed cross-system link" must also handle the common case where it's null despite a real link existing.

## 4. Sentinel dates and non-standard nulls

`CacheProducts.OdooLastSync` uses `1899-12-30T00:00:00.000Z` (a .NET default-datetime-style sentinel) to mean "never synced," not an actual timestamp. Any date-range profiling, normalization, or reconciliation logic must special-case this value (and watch for other similar sentinels — e.g. `0001-01-01`, `9999-12-31`) rather than accepting it as real chronology.

## 5. Inconsistent identifier casing and format

- `MolasCacheDb.CacheCustomers.CardCode` real values include `b00000000` (lowercase), `C00000000`, `C10004` — mixed case and length, same table.
- Warehouse codes across `CacheProducts` include `01`, `COCWHSE`, `MainWHSE` — no single convention.
- `NeonAutoHubSalesOrders.CardCode = "0001"` recurs across many documents — very likely a generic/walk-in customer code, not one real party. Naive exact-match customer consolidation would incorrectly merge every walk-in sale into a single "customer."

## 6. `oitm.item_code` (Parts_Catalog) is not a clean unique key

316 duplicate `item_code` values across 9,154 rows. Any spare-parts matching logic keyed on `item_code` alone will silently collide; a compound key (with `supplier_id` and/or `article_number`) is required.

## 7. `MOLAS_Live_2021_Cache` is effectively empty

The database named for spare parts in the original brief has 0 rows in every commercially-relevant table except `CacheGermaxProducts`. Building a pipeline against this database today would import nothing. The real spare-parts source is `Parts_Catalog` (see [parts-catalog-autohub-profile.md](../data-sources/parts-catalog-autohub-profile.md)) — confirmed by explicit user direction, not inferred.

## 8. `Molaslubes` (intended Odoo/lubricants-replica source) does not exist at the given host

See [odoo-garage-profile.md](../data-sources/odoo-garage-profile.md). Garage-quotation ingestion is deferred until a real, reachable source is confirmed.

## 9. Two independent Germax-branded datasets, not yet reconciled

`CacheGermaxProducts` (SQL Server, 1,177 rows) and `neon_germax_products` (Parts_Catalog, 1,075 rows) both hold Germax spare-parts data. The row-count difference (102) suggests they are not perfectly in sync with each other. Not reconciled in this phase — flagged for a future pass once both are formally ingested through staging.

## 10. Approximate row counts can be stale or `-1`

The initial table-level scan used `sys.dm_db_partition_stats` (SQL Server) and `pg_class.reltuples` (Postgres) for speed, to avoid full-table-scan `COUNT(*)` against live production databases. Several `Parts_Catalog` tables report `-1` (Postgres `reltuples` default before the table is ever analyzed) — this means "unknown," not "zero." Exact counts were obtained via real `COUNT(*)` only for the specific tables deep-profiled in this pass (see the individual profile documents); other tables' counts should be treated as approximate until deep-profiled too.
