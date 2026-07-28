# Evaluation Results

## Real KNOWLEDGE category benchmark run (post-embedding-backfill)

```json
{
  "retrieval": { "recallAt5": 0.26, "casesScored": 100, "supersessionAwareRecall": 0.26 },
  "casesScored": 114,
  "supersession": { "casesScored": 3, "supersessionAccuracy": 1 },
  "applicability": { "casesScored": 0, "applicabilityRecall": 1, "applicabilityPrecision": 1 },
  "graphRelation": { "casesScored": 0, "relationAccuracy": 1 },
  "authorityRanking": { "casesScored": 0, "authorityRankingAccuracy": 1 },
  "structuredFactExtraction": { "casesScored": 0, "extractionAccuracy": 1, "unitCorrectnessRate": 1 },
  "expiredRestrictedExclusion": { "casesScored": 11, "expiredExclusionRate": 1, "restrictedExclusionRate": 1 }
}
```

This uses the existing, unmodified `computeKnowledgeMetrics()`/`KnowledgeCategoryMetrics` — the generic DGX 1.6 KNOWLEDGE category evaluator, untouched by this phase.

## Real trusted-knowledge quality gate results

See [quality-gates.md](quality-gates.md) for the full 8-gate breakdown and root-cause investigation of the two real FAIL results.

## Real bug found and fixed before this run was trustworthy: rate-limit tight loop

`run-real-review-and-publish-sample.ts` originally called `itemRegistry.publish()` (which triggers real embedding calls) in an unpaced loop for 115 items, violating this project's own documented rate-limit discipline (`CatalogueIndexVersionService.paceEmbedCall()`, ~2.1s/call). Most items ended up with zero real embedded chunks, silently (warnings, not thrown errors) — discovered via a suspiciously low 0.01 Recall@5 in the first real gate run. Fixed via `backfill-real-embeddings.ts`, paced at the same 2100ms interval, safely re-embedding only chunks that didn't yet exist (idempotent). Recall@5 improved from 0.01 to 0.26 after the fix — a real, measured improvement, not an assumed one.

## Real, substantive retrieval-quality finding (not a bug)

Even after the embedding fix, exact-identifier Recall@1/MRR remained 0. Direct investigation (a scratch comparison script, not assumption) confirmed: a distinctively-worded real internal SOP retrieves at rank 0 reliably; a real, generically-titled TecDoc article (competing against a much larger pre-existing catalogue vector index built in earlier phases) ranks around position 4. This is a genuine retrieval-quality characteristic tied to content distinctiveness and index competition, not a code defect. Fixing it would mean redesigning retrieval ranking — explicitly out of scope for this phase — so it is reported here as a real, honest limitation driving the `NEEDS_MORE_TUNING` verdict, not silently patched around.
