# Lubricants Data Quality

`src/data-readiness/quality/lubricants-quality.service.ts` — real profiling of the 437 real `LubricantProduct` rows (`sourceSystem = MOLAS_CACHE_LUBRICANTS`).

## Real profile (2026-07-13)

```json
{
  "totalProducts": 437,
  "productCodeUniquenessRate": 1,
  "duplicateNormalizedNameCount": 0,
  "missingViscosityRate": 0.9954,
  "missingPackageSizeRate": 0.9931,
  "missingCategoryRate": 0,
  "missingApiClassificationRate": 0.9977,
  "missingAceaClassificationRate": 0.9977,
  "missingOemApprovalRate": 0.9931,
  "missingCostRate": 0.9931,
  "missingSellingPriceRate": 0,
  "verificationStateCounts": {
    "SOURCE_VERIFIED": 0,
    "DOCUMENT_VERIFIED": 0,
    "PARSED_UNVERIFIED": 2,
    "MANUALLY_VERIFIED": 0,
    "CONFLICTING": 0,
    "MISSING": 435
  }
}
```

## Reading this honestly

Product identity (code uniqueness, name, category, selling price) is essentially complete — every real product has a unique code and a selling price. **Technical specification data (viscosity, API/ACEA classification, OEM approvals) is almost entirely absent** — 99%+ missing across the board. This is a direct, expected consequence of the real source: `MolasCacheDb.CacheProducts` is a commercial/SAP-sync table (item code, name, price, stock), not a technical-specification table. The one source profiled that *does* carry this kind of data — `CacheLiquiMolyProducts` (362 real rows, `SpecGrade` 66.85% null even there) — was **not imported this phase** (see [docs/data-consolidation/lubricants-consolidation.md](../data-consolidation/lubricants-consolidation.md)).

## Verification states

`SOURCE_VERIFIED`/`DOCUMENT_VERIFIED`/`PARSED_UNVERIFIED`/`MANUALLY_VERIFIED`/`CONFLICTING`/`MISSING` (`LubricantsQualityService.classifyVerificationState()`). Real result: 435 of 437 products classify as `MISSING` (no viscosity, API, or ACEA data at all); 2 classify as `PARSED_UNVERIFIED`. **Zero products classify as `MANUALLY_VERIFIED`** — this is correct and expected: no `LubricantApproval.isVerified = true` row exists anywhere in the real imported data, because no human verification pass or verified-approval source has been imported yet. The classifier never promotes a record to `MANUALLY_VERIFIED`/`DOCUMENT_VERIFIED` without a real corresponding fact — it simply has none to point to yet.

## What this blocks

Per [ai-use-case-readiness.md](ai-use-case-readiness.md), "Lubricant specification assistant" is real-evidence-classified `BLOCKED_BY_SOURCE_ACCESS` specifically because of this gap — not a hypothetical concern, a directly measured one.

## Recommendation

Import `CacheLiquiMolyProducts` (real, profiled, not yet ingested) as the next real source for lubricant technical specifications, through the same staging → matching → import pipeline already proven for the rest of this data (see [docs/data-consolidation/staging-model.md](../data-consolidation/staging-model.md)) — no new pipeline mechanics needed, only a new adapter feed and normalizer.
