# Parts Catalogue Quality

`src/data-readiness/quality/parts-quality.service.ts` — real profiling of the 7,730 real `Part` rows (`sourceSystem = PARTS_CATALOG_AUTOHUB`) plus post-validation of the 1,116 real OEM-based consolidations performed during the Data Consolidation phase.

## Real profile (2026-07-13)

```json
{
  "totalParts": 7730,
  "uniqueInternalItemCount": 7722,
  "uniqueOemNumberCount": 7706,
  "recordsWithoutOemNumber": 0,
  "duplicateOemNumberGroups": 18,
  "conflictingDuplicateGroups": 598,
  "missingBrandRate": 0.0206,
  "missingCategoryRate": 0.0235,
  "missingDescriptionRate": 0
}
```

Real catalogue completeness is high — every part has a description, and brand/category are missing only for ~2% of records.

## Post-validation of the 1,116 real automatic consolidations

The Data Consolidation phase correctly consolidated 1,116 spare-parts records into fewer canonical `Part` rows using shared real OEM numbers (see [docs/data-consolidation/parts-consolidation.md](../data-consolidation/parts-consolidation.md)). This phase asked a harder question: **were any of those merges actually wrong** — i.e., did the underlying raw source rows disagree on brand/category/fitment in a way that suggests two genuinely different products were merged?

Real result (898 real Parts with more than one source reference):

| Conflict type | Real count | Share of merged parts |
|---|---|---|
| CONFLICTING_BRAND (different `supplier_name`) | 592 | 66% |
| CONFLICTING_CATEGORY (different `part_group`) | 38 | 4% |
| Both | 32 | 4% |

**This is not as alarming as the raw count suggests, and the two conflict types must be read very differently:**

- **Brand conflicts (592, 66%) are mostly expected, not errors.** In the real aftermarket spare-parts industry, the same OEM cross-reference number is legitimately manufactured and sold by *multiple different suppliers* (that is precisely what an OEM cross-reference means — "any of these aftermarket parts fits this OEM spec"). `supplier_name` in `oitm` reflects which specific catalogue entry/scrape a given record came from, not necessarily a claim that the physical part itself is made by that supplier exclusively. Treating every brand difference as an error would flag a large fraction of completely normal multi-supplier coverage.
- **Category conflicts (38, 4%) are a much stronger real signal.** Two source rows sharing an OEM number but disagreeing on `part_group` (e.g. "Engine" vs. "Suspension") is a genuine identity-error candidate — the same OEM number should never legitimately span two unrelated part categories. **These 38 real cases are the ones prioritized for manual review**, not the 592 brand-only cases.

## Recommendation

Route the 38 real `CONFLICTING_CATEGORY` cases (and the 32 that show both conflict types) to `ManualReviewItem` (queue type `PARTS_DUPLICATE`) for a real human check; treat the remaining ~560 brand-only conflicts as expected multi-supplier coverage, worth a lighter-touch periodic review, not urgent exception handling.

## Differentiating duplicate types (design, partially implemented)

The phase asked for a fuller taxonomy (exact duplicate / re-catalogued same item / compatible alternative / superseded item / related kit / conflicting identity / unresolved candidate) than this pass fully implements — `postValidateOemConsolidations()` currently distinguishes brand vs. category conflict specifically (the two signals with real data behind them); supersession and kit-relationship data (`oitm`'s `is_kit`/`kit_component_count` fields exist in the real source but weren't imported this phase) would extend this classification further. See [decision-log.md](decision-log.md).
