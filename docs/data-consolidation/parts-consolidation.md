# Parts Consolidation

`src/data-consolidation/matching/part-consolidation-matching.service.ts` — reuses Phase 1's `normalizeOemNumber()` (`src/parts/normalize.ts`) rather than inventing a second normalization scheme, per the phase's explicit instruction to use existing Phase 1 parts matching.

## Match levels

- **EXACT**: an existing `PartExternalReference` for this exact source record; or exactly one existing `Part` with the same `internalItemCode`.
- **HIGH_CONFIDENCE**: exactly one existing `Part` with the same normalized OEM number.
- **POSSIBLE_MATCH**: the OEM number matches an existing `PartAlternateNumber` row instead of a primary `oemNumber`.
- **CONFLICT**: more than one existing `Part` shares the same `internalItemCode` or OEM number — a real, detected duplicate in the target data itself, requiring a human decision rather than picking one arbitrarily.
- **NO_MATCH**: nothing matches (or the record has no item code at all) — a new `Part` is created.

`PartMatcherService` (Phase 1, `src/parts/matching/`) is unchanged — it remains the separate Part-to-Part duplicate detector that runs after Parts already exist. `PartConsolidationMatchingService` answers a different, earlier question: does this staged spare-parts record correspond to an existing Part at all.

## Real result (2026-07-12, `PARTS_CATALOG_OITM_ITEMS`, 9,154 real `oitm` rows from Parts_Catalog/AutoHub)

- 8,839 distinct records survived staging dedup (real `item_code` duplicates collapse to one staged row — see below)
- 7,723 new Parts created
- **1,116 correctly consolidated into an existing Part via a shared real OEM number** — e.g. item codes `VAG10769` and `VAG13636` both carry OEM `059903133R` and both correctly resolved to the same canonical `Part`, with two `PartExternalReference` rows pointing at it. This is real evidence the same physical part had been re-catalogued under different internal item codes in the source data, and the matching logic caught it without human intervention (HIGH_CONFIDENCE, not POSSIBLE_MATCH — an exact OEM match is not ambiguous).
- 0 manual-review items — no real conflicting/ambiguous item found in this batch
- 0 errors

## Real data-quality handling

- **Duplicate `item_code`** (316 duplicate values found during profiling — see [parts-catalog-autohub-profile.md](../data-sources/parts-catalog-autohub-profile.md)): the adapter's per-feed staging key is `item_code`; rows sharing the same code collapse to the last-extracted row at the staging layer. This is acceptable for master-data fields (name, price, category) but means per-warehouse/per-batch stock detail tied to a duplicated code is not separately preserved in this pass — a real, documented limitation, not silently swallowed.
- **Missing item code**: routed to `NO_MATCH` immediately, never attempted against an unrelated existing Part.
- **Conflicting OEM/item-code ownership**: routed to `CONFLICT`, not merged.

## Vehicle compatibility, superseded numbers

`oitm_compatible_vehicle` (1.36M real rows) and TecDoc fitment tables exist and were profiled but are **not imported in this pass** — that's a very large, separate dataset best handled as its own bounded batch once the item-master consolidation above is reviewed and approved. See [decision-log.md](decision-log.md).
