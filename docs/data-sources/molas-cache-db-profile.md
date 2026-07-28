# Source Profile — MolasCacheDb (Lubricants)

**Real, live production database.** Profiled read-only via `scripts/profile-sources.ts` / `scripts/profile-sources-deep.ts` on 2026-07-12 against the actual SQL Server instance. All figures below are real query results, not estimates from documentation.

## What this database actually is

The name suggests a passive "SAP cache," but real inspection shows something more specific: **an active, bidirectional SAP Business One ↔ Odoo middleware database for lubricants**, built with Entity Framework Core (`dbo.__EFMigrationsHistory`, 26 applied migrations). Every commercial table carries `Odoo*` columns — `OdooCustomerId`, `OdooProductId`, `OdooSalesOrderId`, `OdooInvoiceId`, `OdooDeliveryId`, `OdooPaymentId`, `OdooStatus`, `OdooSyncDir`, `OdooLastSync`, `OdooErrorMsg` — meaning a separate service already keeps SAP B1 and Odoo in sync for lubricants commercial documents. This database is this system's read-only window into that sync state, not the thing we're building.

It also contains its own small internal application: `InternalUsers`, `InternalUserTokens`, `AuthAuditEvents`, `BrandRoleMappings`, `CacheNotificationDeviceTokens` — **out of scope for this phase** (per explicit decision — see [decision-log.md](../data-consolidation/decision-log.md)); not modeled, not read for consolidation purposes.

## Connection

- **Method**: `mssql` (Tedious) over TCP, SQL Server authentication.
- **Credentials strategy**: a single `sa` (sysadmin) login was provided. This is **not permission-scoped to read-only** — the safety guarantee here is entirely a code-discipline matter (every query in this codebase against this database must be a `SELECT`; see [decision-log.md](../data-consolidation/decision-log.md) for why a scoped login is still recommended).
- Real connectivity confirmed at `localhost:1433` (same physical machine as this application in this environment).

## Tables relevant to consolidation

| Table | PK | Real row count | Notes |
|---|---|---|---|
| `CacheCustomers` | `CardCode` | 4,247 | Real SAP business-partner codes (`CardCode` values seen: mixed-case, e.g. `b00000000`, `C00000000`, `C10004` — inconsistent format) |
| `CacheProducts` | `[ItemCode, WarehouseCode]` | 1,302 | Per-warehouse stock rows; warehouse codes seen are inconsistent (`01`, `COCWHSE`, `MainWHSE` — numeric and two different textual conventions) |
| `CacheSalesOrders` | `SapDocEntry` | 2,386 | `DocDate` range: **2024-03-20 to 2026-07-11** (real, ~2.3 years, current) |
| `CacheSalesOrderLines` | `Id` (FK `SapDocEntry`) | 4,271 | |
| `CacheInvoices` | `SapDocEntry` | 12,802 | `DocDate` range: **2024-02-04 to 2026-07-12** (today — actively synced) |
| `CacheInvoiceLines` | `Id` (FK `SapDocEntry`) | 22,863 | |
| `CacheDeliveries` | `SapDocEntry` | 8,957 | `DeliveryDate` range: 2024-02-04 to 2026-07-11; `IsCancelled` flag present |
| `CacheDeliveryLines` | `Id` (FK `SapDocEntry`) | 16,054 | |
| `CachePayment` | `SapDocEntry` | 11,767 | `DocDate` range: 2024-02-04 to 2026-07-10 |
| `CacheLiquiMolyProducts` | `ArticleNumber` | 362 | LiquiMoly-branded product data scraped/enriched separately from the SAP item master — has `Approvals`, `Specifications` (JSON-ish text fields), `SpecGrade` |
| `CacheLiquiMolyReplenishmentRequests(Lines)`, `CacheLiquiMolyTransfers(Lines)` | `Id` | 63 / 506 / 7 / 7 | Brand-specific replenishment/transfer workflow — not yet profiled in depth |
| `CacheStockReservations` | `Id` | 37 | |

## Real data-quality findings

- **`CacheCustomers.OdooCustomerId` is 100% NULL** across all 4,247 rows, despite `OdooStatus = 'SYNCED'` and a populated `OdooLastSync` on sampled rows — the sync bridge records *that* a sync happened but the Odoo-side ID isn't captured for customers. Don't rely on this column for customer matching.
- **`CacheDeliveries.OdooDeliveryId` is 100% NULL**; **`CachePayment.OdooPaymentId` is 85.2% NULL** — deliveries and most payments are not round-tripped to Odoo, or the ID isn't recorded. `CacheProducts.OdooProductId` is fully populated (0% null) by contrast — sync completeness varies significantly by entity type.
- **Sentinel "never synced" date**: `CacheProducts.OdooLastSync` uses `1899-12-30T00:00:00.000Z` as a not-null placeholder (the classic .NET `DateTime` default-ish sentinel), not an actual sync timestamp. Any consumer must special-case this value rather than treat it as a real date.
- **`CacheProducts.RowVersion`** is a genuine SQL Server `rowversion`/timestamp binary column — usable as a cheap, reliable incremental-extraction cursor (monotonically increasing per row change) if this table is ever ingested directly.
- **`CacheLiquiMolyProducts.SpecGrade`** is 66.85% NULL — most LiquiMoly products don't have a parsed viscosity/spec grade populated. Confirms the original phase instruction not to infer viscosity from names.
- **Inconsistent header key naming**: `CacheSalesOrders` uses `CustomerCode`/`CustomerName`, while `CacheInvoices`/`CacheDeliveries`/`CachePayment` use `CardCode`/`CardName` for the same real-world concept (SAP business partner). A mapping layer must normalize this, not assume one column name across tables.
- Real sample confirms Tanzania-based operation: `BillToCountry = "TZ"`, prices in the tens-of-thousands range consistent with TZS (e.g. a lubricant priced at 93,220.34).

## Candidate business keys

- Customer: `CardCode` (unique, 0 duplicates across 4,247 rows).
- Product: `ItemCode` (not unique alone — repeats once per warehouse); real unique key is `[ItemCode, WarehouseCode]`.
- Sales order / invoice / delivery / payment header: `SapDocEntry` (confirmed unique per table).

## Known anomalies / risks

- `sa` login has full write access to a live production database — see [source-data-risks.md](source-data-risks.md).
- Odoo bridge fields are unevenly populated — do not treat them as a complete customer/product/document identity map between SAP and Odoo.
- Inconsistent code casing/format on `CardCode` and warehouse codes will need real normalization rules, not a naive exact-match join.
