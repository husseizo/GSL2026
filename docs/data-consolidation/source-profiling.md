# Source Profiling

Real, read-only profiling was performed against every reachable source before any adapter or mapping was designed — per the phase's explicit instruction not to begin with blind import. See `services/operational-core/scripts/profile-sources.ts` (table/column/PK-level scan) and `scripts/profile-sources-deep.ts` (row counts, null rates, date ranges, masked samples, duplicate-key detection) for the exact, real, executable methodology.

## What was profiled

1. **Connect read-only** — real `mssql`/`pg` connections, `sa`/Neon credentials (see [source-data-risks.md](../data-sources/source-data-risks.md) §1 on the `sa` credential).
2. **Enumerate schemas/tables/columns** — `sys.tables`/`sys.columns` (SQL Server), `information_schema.columns` (Postgres).
3. **Identify primary keys** — `sys.indexes`/`sys.index_columns` (SQL Server); inferred from real duplicate-count checks (Postgres, since several tables there have no declared PK).
4. **Count rows** — approximate first (`sys.dm_db_partition_stats`, `pg_class.reltuples` — avoids a full-table-scan `COUNT(*)` against a live production database), then exact `COUNT(*)` for the tables confirmed relevant.
5. **Null rates, date ranges, duplicate-key rates** — real aggregate queries per confirmed-relevant table (see the deep-profile output baked into each `docs/data-sources/*.md` file).
6. **Masked samples** — `maskRow()` in `profile-sources-deep.ts` redacts phone/email/tax/address/name-shaped columns before printing, so no raw customer PII reached a doc or a log line.

## Results

See the per-source documents for full detail:

- [molas-cache-db-profile.md](../data-sources/molas-cache-db-profile.md)
- [molas-live-2021-cache-profile.md](../data-sources/molas-live-2021-cache-profile.md)
- [parts-catalog-autohub-profile.md](../data-sources/parts-catalog-autohub-profile.md)
- [odoo-garage-profile.md](../data-sources/odoo-garage-profile.md)
- [source-data-risks.md](../data-sources/source-data-risks.md) — cross-cutting findings

## Why this mattered

Profiling changed the plan materially before a single row was imported:

- `MOLAS_Live_2021_Cache`, the source named in the original brief for spare parts, turned out to be almost entirely empty. Blind-importing from it would have produced a pipeline that silently did nothing.
- `Parts_Catalog` — not named in the original brief at all — turned out to hold the real, populated spare-parts commercial history via an existing "AutoHub" application.
- `MolasCacheDb`'s real schema revealed it's an active SAP↔Odoo bridge with its own internal auth/user tables, not a passive read-only cache — changing what "read-only" needed to mean for this integration (a code-discipline guarantee, since the `sa` credential itself isn't scoped).
- Real column-level inspection surfaced concrete data-quality facts (a .NET sentinel "never synced" date, inconsistent `CardCode`/`CustomerCode` naming, 316 duplicate `item_code` values) that directly shaped the matching and normalization logic — see [customer-consolidation.md](customer-consolidation.md) and [parts-consolidation.md](parts-consolidation.md).
