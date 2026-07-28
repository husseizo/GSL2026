# Operations Guide

## Real one-shot scripts

1. `scripts/build-retrieval-intelligence-gold-eval.ts` — builds/reuses the real `RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1` gold benchmark from real generators (see [benchmark-methodology.md](benchmark-methodology.md)). Idempotent — checks for an existing frozen benchmark by key before creating a new one.
2. `scripts/verify-retrieval-intelligence.ts` — the real, end-to-end verification script covering every item in spec §22. Run via `npx ts-node -T scripts/verify-retrieval-intelligence.ts`.

## Real, honest sampling bound in quality-gate computation

`computeRetrievalIntelligenceGateInputs()` samples up to `GATE_SAMPLE_SIZE = 150` real gold cases (ordered by their own random UUID `id`, an approximately-unbiased sample across every category) rather than scoring the entire real gold set (1,840 cases as of this pilot) — at real, observed per-query latency (~1–6 seconds, dominated by real DGX embedding calls and graph traversal), scoring all 1,840 would take multiple hours per run. This mirrors DGX 1.7.1's own "samples up to 50 published versions" precedent. Increase `sampleSize` for a more exhaustive (but much slower) run if needed.

## Known operational gotchas found this pilot

- **Real per-query latency is dominated by the DGX embedding call and graph traversal**, not application logic — a single `pipeline.retrieve()` call typically takes 1–6 real seconds. Any bulk operation over real queries (gold-case scoring, Query Lab comparisons) must budget for this; there is no artificial rate limit on `RetrievalPipelineService.retrieve()` itself, but the underlying `AiGatewayService.embed()` is real-rate-limited (~30 req/60s per actor) — a script issuing hundreds of unpaced calls under the same actor key will see some calls silently rate-limited (`available: false`), which degrades only the semantic-widening candidates, not deterministic identifier lookups.
- **The `integration` Jest project points at a separate `aios_operational_test` database**, not the real, pre-seeded dev corpus. Integration specs must create their own real, clearly-labeled test fixtures rather than assume dev-DB data exists.
- **Never assume a character-level perturbation of a shape-specific identifier (e.g. `INTERNAL_ITEM_CODE`) will classify as `TYPO`** — a same-shape digit substitution usually still matches the exact pattern (shape recognition correctly takes priority over typo-guessing). Real typo tests should perturb a broader-shaped identifier (e.g. an OEM number) instead.

## Real feature flag

`RETRIEVAL_INTELLIGENCE_ENABLED` (default unset/false) — gates whether `CatalogueRagService` and `KnowledgeRetrievalService` actually consult `RetrievalPipelineService`. Flip to `true` only after confirming the real quality gates pass (see [quality-gates.md](quality-gates.md)) — mirroring `KnowledgeSnapshotService.activate()`'s own gate-blocking discipline.

## See also

[final-report.md](final-report.md) for the full real verdict and remaining limitations.
