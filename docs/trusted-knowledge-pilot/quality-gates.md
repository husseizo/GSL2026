# Trusted Knowledge Quality Gates

## A separate evaluator, not a `quality-gates.ts` rewrite

`src/ai-benchmark/pipeline/trusted-knowledge-quality-gates.ts` is a wholly new, additive evaluator. DGX 1.6's generic 7-gate `evaluateGates()`/`quality-gates.ts` remains byte-for-byte unchanged. `computeTrustedKnowledgeGateInputs(prisma, retrieval, goldBenchmarkId)` computes real inputs via Prisma queries and real `searchKnowledge()` calls; `evaluateTrustedKnowledgeGates()` and `allTrustedKnowledgeGatesPass()` apply the spec's exact thresholds. Results are stored in `KnowledgeSnapshot.evaluationMetrics.trustedKnowledgeGates` — merged into the existing `Json?` field, never overwriting other keys already there.

## Activation gating

`KnowledgeSnapshotService.activate()` gained exactly one new, additive precondition: activation is blocked unless `evaluationMetrics.trustedKnowledgeGates.allPass === true`. This only activates when that key is present, so it is fully backward-compatible with any DGX 1.7 snapshot flow that never sets it.

## Real gate results (last real run, post-embedding-backfill)

| Gate | Threshold | Real actual | Status |
|---|---|---|---|
| EXACT_IDENTIFIER_RECALL (Recall@1) | 1.00 | 0 | **FAIL** |
| MRR | ≥0.90 | 0 | **FAIL** |
| CITATION_CORRECTNESS | ≥0.98 | null | WAIVED (no citations returned to check yet) |
| UNSUPPORTED_CLAIM_RATE | ≤0.02 | 0 | PASS |
| RESTRICTED_LEAKAGE | 0 | 0 | PASS |
| EXPIRED_CURRENT_ANSWER_RATE | 0 | 0 | PASS |
| INJECTION_REFUSAL_ACCURACY | 1.00 | 1.00 | PASS |
| GOLD_HUMAN_APPROVAL | true | true | PASS |

**All pass: false.** Activation was attempted and correctly blocked (see [knowledge-snapshot.md](knowledge-snapshot.md)).

## Root cause of the two FAIL results (investigated directly, not assumed)

Recall@5 improved from 0.01 to 0.26 after fixing a real rate-limit tight-loop bug that had left most published items without real embeddings (see [evaluation-results.md](evaluation-results.md)). Recall@1/MRR remained 0 even after that fix. Direct comparison testing confirmed: distinctively-worded content (internal SOPs) reliably retrieves at rank 0; short, generic TecDoc article titles — competing against a much larger pre-existing catalogue vector index from earlier phases — rank lower (e.g. rank 4). This is a genuine retrieval-quality characteristic of the real corpus and real index composition, not a computation bug in the gate evaluator itself. Redesigning retrieval ranking to fix this is explicitly out of scope for this phase (see the DGX 1.7.1 spec's scope constraints) — so the gate is left failing, honestly, rather than loosened or worked around.

## Never-bypass discipline

No code path exists that forces `allPass = true` or skips the gate check. The `activate()` call in `run-real-snapshot-and-gates.ts` and in the verify script both attempt real activation and report the real outcome (BLOCKED), never a forced success.
