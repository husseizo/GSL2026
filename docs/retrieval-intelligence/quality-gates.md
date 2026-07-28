# Retrieval Intelligence Quality Gates

## A separate evaluator, mirroring DGX 1.7.1's pattern exactly

`src/ai-benchmark/pipeline/retrieval-intelligence-quality-gates.ts` is a wholly new, additive evaluator. DGX 1.6's generic `quality-gates.ts` and DGX 1.7.1's `trusted-knowledge-quality-gates.ts` both remain byte-for-byte unchanged.

## The 10 real gates (spec §20, verbatim thresholds)

| Gate | Threshold |
|---|---|
| `RECALL_AT_1` | ≥ 0.98 |
| `MRR` | ≥ 0.95 |
| `IDENTIFIER_ACCURACY` | = 1.00 |
| `WRONG_FITMENT` | = 0 |
| `WRONG_SUPERSESSION` | = 0 |
| `WRONG_LUBRICANT_APPROVAL` | = 0 |
| `RESTRICTED_LEAKAGE` | = 0 |
| `CURRENT_VERSION_ACCURACY` | ≥ 0.99 |
| `LATENCY` (p95) | ≤ 5000ms |
| `NO_REGRESSION_VS_1_7_1` | current Recall@1 ≥ 1.7.1's persisted baseline |

Every gate is computed from real live `RetrievalPipelineService.retrieve()` calls against the real corpus and real gold benchmark — never hardcoded. A gate with no real data to compute from yet is `WAIVED`, never silently treated as `FAIL`.

## Real sampling bound

Gate computation samples up to 150 real gold cases (see [operations-guide.md](operations-guide.md)) rather than the full real gold set, for practical real runtime — a named, honest bound, not silent truncation.

## Real results

See [final-report.md](final-report.md) and [evaluation-results.md](evaluation-results.md) for the actual measured gate outcomes from this pilot's real verify run.

## Never bypassed

No code path exists that forces a gate to `PASS` or skips evaluation. `RETRIEVAL_INTELLIGENCE_ENABLED` stays off until every mandatory gate genuinely passes on real data — matching the exact activation discipline `KnowledgeSnapshotService.activate()` already established.
