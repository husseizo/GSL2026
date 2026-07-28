# Benchmark Methodology

## Real metrics (spec §11)

Reuses, never duplicates, the existing pure metric primitives in `src/catalogue-ai/evaluation/retrieval-metrics.ts`: `recallAtK`, `reciprocalRank`/`meanReciprocalRank`, `ndcg`, `conflictDetectionAccuracy`. New, additive metrics computed directly inside `retrieval-intelligence-quality-gates.ts` for domain-specific correctness: identifier accuracy, wrong-fitment/wrong-supersession/wrong-lubricant-approval counts, restricted-leakage count, current-version accuracy, p95 latency.

## Gold dataset composition (spec §12)

`RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1` (`scripts/build-retrieval-intelligence-gold-eval.ts`) composes real cases from two sources:

1. **Reused, unmodified DGX 1.6 generators** — `buildRetrievalCases()`/`buildConflictDetectionCases()` (`identifier-scaled-cases.ts`, up to 500 real self-consistency cases per identifier type from the real 7,723-part/434-lubricant catalogue), `buildSwahiliCases()`/`buildEnglishCases()`/`buildMixedLanguageCases()` (`language-cases.ts`, real human-verified Swahili templates over real OEM numbers), `buildSupersessionCases()` (`knowledge-cases.ts`).
2. **New generators this phase** (`retrieval-intelligence-cases.ts`) — fitment (from the real 50,002+ `FITS` graph edges), lubricant approval, engine-code/VIN (from the real, small internal `Vehicle` table), procedure (from the real 8 self-authored SOPs), typo (deterministic character-transposition perturbation of real identifiers — a standard IR-evaluation robustness technique, not fabricated content), no-answer (structurally-guaranteed-nonexistent identifiers), restricted-content (from real `RESTRICTED`+`allowedAiUse=false` sources).

Only cases already marked `APPROVED` by their generator enter the frozen gold set — `REVIEW_REQUIRED` cases (typo/partial-description perturbations) are excluded from `addCases()` before `freezeAsGold()` is called, since that call's checksum covers every attached case and spec §12 requires every case to have real human approval.

## Real thresholds enforced, never hardcoded

`computeRetrievalIntelligenceGateInputs()` (`src/ai-benchmark/pipeline/retrieval-intelligence-quality-gates.ts`) runs every real gold case through the live `RetrievalPipelineService`, never a mocked or assumed result. See [evaluation-results.md](evaluation-results.md) for the real numbers this produced and [quality-gates.md](quality-gates.md) for the gate outcomes.
