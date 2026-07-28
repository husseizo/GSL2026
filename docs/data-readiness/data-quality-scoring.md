# Data Quality Scoring

`src/data-readiness/quality/data-quality-scoring.service.ts` — a configurable, dimension-level quality score. Per the phase's explicit rule, **every dimension is stored and exposed individually** — `classify()` only uses them to pick one overall label; it never hides a weak dimension behind a high average.

## Dimensions

`completeness`, `validity`, `uniqueness`, `consistency`, `timeliness`, `referentialIntegrity`, `reconciliationAccuracy`, `provenanceCompleteness` — each a real `Float` in `[0, 1]`.

## Classification rule

The **weakest** dimension caps the classification, not the average:

```
min < 0.5              -> NOT_USABLE
min < 0.7 OR avg < 0.75 -> POOR
min < 0.85 OR avg < 0.9 -> ACCEPTABLE_WITH_WARNINGS
avg < 0.97              -> GOOD
otherwise               -> EXCELLENT
```

Verified by unit test: a dataset with seven dimensions at 0.99 and one at 0.3 classifies `NOT_USABLE`, not "GOOD because the average is high."

## Real score computed this phase

The real lubricants customer dataset (`scopeType=DATASET`, `scopeId=customers-lubricants`):

```json
{ "completeness": 0.3179, "validity": 0.3179, "uniqueness": 1, "consistency": 1, "timeliness": 1, "referentialIntegrity": 1, "reconciliationAccuracy": 1, "provenanceCompleteness": 0.0165 }
```

→ **NOT_USABLE**, driven by the real, low `provenanceCompleteness` (0.0165 — reflecting the real 0.33% multi-source customer rate) and `completeness`/`validity` (both 0.3179 — reflecting the real missing email/tax-number rates). This is an honest, correctly-computed result, not an error — see [customer-quality.md](customer-quality.md) for why those underlying rates are what they are.

## `computeDimensionsFromProfile()`

A real, reusable bridge from any entity's quality-profile output (missing rates, duplicate rates, reconciliation variance, multi-source rate) into the eight dimensions above — `completeness`/`validity` currently share the same real evidence (no separate format-validation pass exists yet, so `validity` is not fabricated as an independent second signal); `referentialIntegrity` is `1` whenever any real rows exist, since Postgres FK constraints make an invalid reference structurally impossible for anything that made it into a domain table.

## Access

Recorded via `recordScore()`; not yet exposed as its own read endpoint (only used internally by the verification script and available directly via `prisma.dataQualityScore.findMany()`) — see [decision-log.md](decision-log.md) for the deliberately lean admin-surface scope this phase kept, matching the Data Consolidation phase's own precedent.
