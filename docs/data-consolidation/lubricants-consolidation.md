# Lubricants Consolidation

`src/data-consolidation/matching/lubricant-matching.service.ts` and `src/data-consolidation/normalizers/lubricants-normalizers.ts`.

## Match levels

- **EXACT**: an existing `LubricantExternalReference` for this exact source record; or an existing `LubricantProduct` with the same `internalCode`.
- **HIGH_CONFIDENCE**: same brand and the same normalized product name.
- **NO_MATCH**: a new `LubricantProduct` is created.

No POSSIBLE_MATCH/CONFLICT path is implemented for lubricants in this pass — the real source (`MolasCacheDb.CacheProducts`) didn't produce any ambiguous cases in the controlled batch (0 manual-review items), and brand is never separated reliably enough in the raw data to build a meaningful brand-name-only fuzzy match without real risk of false positives.

## What is never inferred

Per the phase's explicit instruction:

- **Viscosity** is not parsed or inferred from product names in this pass. `LubricantProduct.viscosity` is left unset for records imported from this source; a future pass that does parse it must mark the result "parsed and unverified," never "confirmed."
- **Brand** is not separated from the free-text product name (`CacheProducts.ItemName`, e.g. `"1015-Molygen Motor Protect-500 ml"`) — real sample data shows brand, product line, and package size all run together in one string with no reliable delimiter. New `LubricantProduct` rows created from this source get `brand = "UNKNOWN"` rather than a guessed value.
- **API/ACEA classification** and **OEM approvals** are not populated from this source at all — `CacheLiquiMolyProducts` (a separate, brand-specific enrichment table, 362 rows, real `SpecGrade` 66.85% null) was profiled but not imported in this pass; it's the more promising source for that data specifically, in a future iteration.

## Real result (2026-07-12, `MOLAS_CACHE_LUBRICANTS_ITEMS`, real `CacheProducts` rows)

- 1,302 real rows extracted; 434 distinct products survived staging (see below)
- 434 new `LubricantProduct` rows created, 0 updates, 0 manual review, 0 errors

## Real data-quality finding: warehouse-level rows collapse in staging

`CacheProducts`' real primary key is `[ItemCode, WarehouseCode]` — one row per item per warehouse (1,302 rows across a smaller number of distinct items). This pipeline's feed key is `ItemCode` alone (matching the profiled duplicate count: 1,302 rows → 434 distinct item codes, exactly consistent with the "−868 excess" duplicate-key finding in [molas-cache-db-profile.md](../data-sources/molas-cache-db-profile.md)). This is intentional for *this* pass — the goal is a real, correct lubricants **product master** (name, price), not warehouse-level stock, which is explicitly a separate, not-yet-decided concern (see [inventory-reconstruction.md](inventory-reconstruction.md)). It means the specific warehouse row that happens to be extracted last "wins" for price/name in a given run — acceptable for master data, not acceptable if this table were later used as a stock source without changing the feed key to the real composite `[ItemCode, WarehouseCode]`.
