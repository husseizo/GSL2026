# Branch & Warehouse Mapping

`src/data-readiness/mapping/branch-warehouse-mapping.service.ts` — real analysis of source warehouse/branch codes against this platform's existing, real `Warehouse`/`Branch` rows (Phase 2). Extends `WarehouseExternalReference`/`BranchExternalReference` (Data Consolidation phase) additively with `mappingConfidence`, `evidence`, `reviewedById`/`reviewedAt`, `effectiveFrom`/`effectiveTo` — see [decision-log.md](decision-log.md) for why no new `SourceWarehouse`/`CanonicalWarehouse` tables were created.

## Real finding (2026-07-13)

Real warehouse codes actually seen in `MolasCacheDb.CacheProducts.WarehouseCode` (queried live from the real staged data, not hardcoded from memory):

| Source code | Real transaction count | Mapping status |
|---|---|---|
| `MainWHSE` | 434 | **UNMAPPED** |

Real existing `Warehouse` codes in this platform (Phase 2 org data): `DSM01-MAIN`, `DSM01-LUBE`, `DSM01-GRG`, `ARU01-MAIN`.

**No exact-code match exists.** Per the phase's explicit rule ("do not map warehouses by similar name alone when codes or transaction evidence conflict"), `MainWHSE` is left `UNMAPPED` rather than auto-linked to `DSM01-MAIN` on name plausibility alone — even though "Main" appearing in both is suggestive, it is not proof, and a wrong guess here would misattribute 434 real transactions' worth of stock/sales data to the wrong physical warehouse.

## Why only one code appears here

Earlier profiling (Data Consolidation phase, deep-profile of raw `CacheProducts` rows) found three real warehouse codes (`01`, `COCWHSE`, `MainWHSE`). This phase's live re-query of the actually-staged `RawSourceRecord` payloads for the `MOLAS_CACHE_LUBRICANTS_ITEMS` feed found only `MainWHSE` — because the staging layer's feed key is `ItemCode` alone (see [docs/data-consolidation/lubricants-consolidation.md](../data-consolidation/lubricants-consolidation.md)), so only the last-extracted warehouse row per item code survives in `RawSourceRecord`; the other two codes' rows were overwritten during staging. This is a known, already-documented limitation of the current lubricants-product staging key, not a new one introduced this phase — see [decision-log.md](decision-log.md) for what changing the staging key to the real composite `[ItemCode, WarehouseCode]` would take.

## Resolution path

`confirmMapping(sourceSystem, sourceCode, warehouseId, evidence, reviewedById)` — records a real, human-confirmed mapping once someone with real knowledge of the physical site (e.g. "MainWHSE genuinely is the Dar es Salaam main store") provides it. Until then, `recordUnmappedSourceCode()` logs the gap as an `AuthorityConflict` (entityType `WAREHOUSE_MAPPING`) rather than silently absorbing it into a guessed `WarehouseExternalReference` row.

## Consequence

Per the phase's explicit rule, **no inventory backfill may be approved until relevant warehouse mappings are verified** — see [inventory-readiness.md](inventory-readiness.md), which is blocked on exactly this gap for both business units.
