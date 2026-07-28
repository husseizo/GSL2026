# Leakage Prevention

`src/data-readiness/ml/splits.ts` (time-based and entity-grouped splits) + `src/data-readiness/ml/leakage-checks.ts` (automated checks) — pure, DB-free modules, fully unit-tested.

## Time-based splits, never random

`timeBasedSplit(records, validationDays, testDays)` always puts the earliest records in train and the most recent in test — chronologically ordered, non-overlapping, boundaries recorded. Verified this phase against real data: the lubricant-demand dataset build recorded real boundaries per item, e.g.:

```json
{"trainStart":"2026-04-29","trainEnd":"2026-06-11","validationStart":"2026-06-12","validationEnd":"2026-06-25","testStart":"2026-06-26","testEnd":"2026-07-10"}
```

## Entity-grouped splits, for matching/deduplication datasets

`entityGroupedSplit(records, testFraction, seed)` assigns every record for the *same* real entity (e.g. the same canonical customer) entirely to one split — deterministic per seed (uses FNV-1a hashing, chosen after a naive rolling-hash implementation was found to cluster sequential-ID entities into the same split regardless of seed — see [decision-log.md](decision-log.md)).

## Automated checks (`runAllLeakageChecks`)

| Check | Real scenario it catches |
|---|---|
| `checkFeatureTimestampPrecedesTarget` | Using invoice status that becomes known only after prediction time; using future sales to predict earlier demand |
| `checkNoTemporalOverlap` | A train/test split whose date ranges overlap |
| `checkNoEntityOverlap` | Near-duplicate records (e.g. from a customer-matching dataset) appearing in both train and test |
| `checkProhibitedFieldsAbsent` | Using final approval status to predict quote approval; using payment completion to predict order conversion before it occurred |

## Real leakage-check run (2026-07-13)

The lubricant-demand dataset build ran `checkNoTemporalOverlap` for all 213 real items — **213 checks run, 0 failures**. (One real edge case was caught and fixed during this run: several short-history items produce an empty train *or* test bucket, which the original check implementation crashed on via `new Date(-Infinity).toISOString()` — fixed to treat an empty bucket as a real, valid pass rather than an error. See [decision-log.md](decision-log.md).)

## Real leakage scenarios from the original brief, and how this phase's design avoids each one

- **Using invoice status known only after prediction time** — not currently possible: no invoice data is imported yet (see [commercial-document-semantics.md](commercial-document-semantics.md)), so no feature can reference it.
- **Using future sales to predict earlier demand** — prevented structurally by `timeBasedSplit` always ordering train before test.
- **Using canonical merge decisions as features when predicting those same decisions** — flagged explicitly as a real risk in [ai-use-case-readiness.md](ai-use-case-readiness.md)'s "OEM-number matching assistance" and "Customer entity-resolution assistance" entries (`targetLeakageRisk: MEDIUM`), not yet built into an automated check because no such model exists yet to check.
- **Using later corrected product descriptions in historical training without versioning** — `RawSourceRecord`'s checksum-based re-staging (Data Consolidation phase) already tracks *when* a record's content changed; a future feature-engineering pass building historical training data must join against `RawSourceRecord.extractedAt`, not just the current `Part`/`LubricantProduct` row, to avoid this — documented here as a requirement, not yet enforced by an automated check since no such training pipeline exists yet.
- **Using future warehouse balances** — no warehouse-balance time series exists yet (see [inventory-readiness.md](inventory-readiness.md)), so this can't currently occur.
- **Using post-outcome garage notes / final approval status to predict quote approval** — no real garage/quotation data exists yet (see [docs/data-sources/odoo-garage-profile.md](../data-sources/odoo-garage-profile.md)), so this can't currently occur either.
