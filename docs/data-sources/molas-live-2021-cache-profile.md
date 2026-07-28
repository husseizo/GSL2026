# Source Profile — MOLAS_Live_2021_Cache (Spare Parts)

**Real, live SQL Server database. Profiled read-only on 2026-07-12.** Same instance as `MolasCacheDb` (`localhost`), same `sa` credential.

## Key finding: this database is essentially empty

The schema is a near-exact mirror of `MolasCacheDb` (`CacheCustomers`, `CacheProducts`, `CacheSalesOrders`, `CacheInvoices`, `CacheDeliveries`, `CachePayment`, `CacheLiquiMolyProducts`, etc. — same column shapes, same EF Core migration history pattern with its own `__EFMigrationsHistory_Live2021Cache` table), but **every one of those tables has 0 rows**, with a single exception:

| Table | Real row count | Notes |
|---|---|---|
| `CacheGermaxProducts` | 1,177 | PK `ItemCode`. Populated. |
| `__EFMigrationsHistory` | 17 | |
| `__EFMigrationsHistory_Live2021Cache` | 2 | |
| `CacheCustomers`, `CacheDeliveries`, `CacheDeliveryLines`, `CacheInvoiceLines`, `CacheInvoices`, `CacheLiquiMolyProducts`, `CacheLiquiMolyReplenishmentRequests(Lines)`, `CacheLiquiMolyTransfers(Lines)`, `CachePayment`, `CacheProducts`, `CacheSalesOrderLines`, `CacheSalesOrders`, `CacheStockReservations` | **0** | Schema exists (migrated), no data has been synced into it yet. |

## What this means for consolidation

Per the user's explicit direction (see [decision-log.md](../data-consolidation/decision-log.md)), **real spare-parts commercial data does not live here** — it lives in the Neon Postgres `Parts_Catalog` database's `NeonAutoHub*` tables (see [parts-catalog-autohub-profile.md](parts-catalog-autohub-profile.md)). This database is profiled and documented for completeness and because its schema is real and reachable, but it is **not** the target of the spare-parts adapter in this phase. If a real SAP↔Odoo spare-parts sync is later stood up the same way `MolasCacheDb` was for lubricants, this profile is the starting point — the schema shape is already known and matches its lubricants sibling closely enough that most of [molas-cache-db-profile.md](molas-cache-db-profile.md)'s findings (sentinel dates, uneven Odoo-field population, `CardCode`/`CustomerCode` naming inconsistency) would likely apply here too.

## Populated table: `CacheGermaxProducts`

- PK: `ItemCode`, 1,177 rows.
- "Germax" is a spare-parts brand — the same brand also appears as `neon_germax_products` (1,075 rows) in the `Parts_Catalog` Neon database, suggesting this SQL Server table and that Postgres table are two ends of an existing sync for this one brand specifically. Not yet reconciled against each other in this pass — flagged for a future consolidation pass, not built in this phase.

## Known anomalies / risks

- An almost-entirely-empty "cache" database whose name and schema strongly imply it's meant to be populated is itself a risk signal: don't assume its emptiness is permanent, and don't build a pipeline that would silently do nothing forever if someone does start populating it later. Re-profile before assuming this document is still accurate.
- Same `sa`-credential risk as `MolasCacheDb` — see [source-data-risks.md](source-data-risks.md).
