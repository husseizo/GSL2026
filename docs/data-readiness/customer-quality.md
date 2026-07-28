# Customer Data Quality

`src/data-readiness/quality/customer-quality.service.ts` — real profiling of the imported real customer dataset (`Customer` rows with `sourceSystem = MOLAS_CACHE_LUBRICANTS`).

## Real profile (2026-07-13, 3,995 real customers)

```json
{
  "totalCustomers": 3995,
  "duplicateCustomerCodeRate": 0,
  "duplicateNormalizedPhoneRate": 0,
  "duplicateEmailRate": 0.0103,
  "nameOnlyAmbiguityRate": 0,
  "missingPhoneRate": 0.0829,
  "missingEmailRate": 0.9635,
  "missingTaxNumberRate": 1,
  "multiSourceCustomerRate": 0.0033,
  "activeRate": 1,
  "customersWithTransactionsButNoIdentityMapping": 1822,
  "completenessScore": 0.3179,
  "identityConfidenceScore": 0.9966
}
```

## Reading these numbers honestly

- **`missingTaxNumberRate = 1` (100%)** — expected, not a defect: `MolasCacheDb.CacheCustomers` never had a tax-number field to begin with (confirmed during the Data Consolidation phase's profiling). This isn't data loss; the field simply doesn't exist at the source.
- **`missingEmailRate = 0.9635`** — real: most customers in this retail/garage-supply business genuinely have no email on file (a phone-first market).
- **`completenessScore = 0.3179`** is *correctly* low given the above — it is not hidden behind a misleadingly high average (see [data-quality-scoring.md](data-quality-scoring.md)). The resulting `DataQualityScore` for this dataset classifies as **NOT_USABLE** overall, specifically because of the completeness/validity dimension — genuinely low for AI training on missing-field-dependent features, while identity (uniqueness/consistency) remains high.
- **`identityConfidenceScore = 0.9966`** — very high: duplicate customer codes, phones are both effectively zero, meaning the *identity* of each customer record is trustworthy even though many *fields* on that record are blank.
- **`customersWithTransactionsButNoIdentityMapping = 1822`** — real: these are `SalesDocument` rows (mostly from `PARTS_CATALOG_AUTOHUB`, which has no customer master) carrying `unresolvedCustomerRef` instead of a resolved `customerId` — an honest, already-documented limitation (see [docs/data-consolidation/parts-consolidation.md](../data-consolidation/parts-consolidation.md)), not a new bug.

## Business-value / eligibility tiering

`CustomerQualityService.computeBusinessValue(customerId)` — real total sales value, transaction count, source-system count, and recency, computed live from `SalesDocument`. This feeds review prioritization directly (see [manual-review-programme.md](manual-review-programme.md)) rather than a separate scoring pass.

## Multi-source rate

Only 0.33% of customers have more than one `CustomerExternalReference` — expected, since only one real source (`MOLAS_CACHE_LUBRICANTS`) has a customer master imported this phase; a customer appearing in two sources would require a second real customer-bearing source, which doesn't exist yet for spare parts.
