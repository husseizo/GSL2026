# Context Construction and Minimization

## Evidence grouping

`src/catalogue-ai/rag/context-builder.ts`'s `buildContext()` groups every retrieved candidate into exactly one of four labeled sections, in a fixed rendering order:

1. **Verified facts** — `isApproved && confidence >= 0.9 && !hasConflict`.
2. **Lubricant approval evidence** — `sourceType === 'LUBRICANT_DOCUMENTATION'` (checked before the generic candidate-matches bucket, and explicitly labeled in the rendered prompt text as "parsed and unverified unless the record states otherwise").
3. **Candidate matches** — everything else that isn't conflicted.
4. **Conflict evidence** — `hasConflict === true`, always, regardless of confidence — a conflicted candidate can never appear in "verified facts" no matter how high its own `confidence` field is, mirroring the same rule `hybrid-ranking.ts` already enforces for search-result ordering.

Each section is rendered with a real, explicit label describing its evidentiary status, not just an unlabeled list — the LLM (and a human reading the raw rendered prompt) sees the difference between "verified facts" and "candidate matches" as structure, not implied by hoping the model infers it from prose. Verified via `context-builder.spec.ts` (6 tests): a conflicted candidate is always placed in conflict evidence even at maximum confidence; a lubricant-sourced candidate always lands in lubricant evidence regardless of confidence; an empty candidate list renders an explicit "Missing information" section rather than an empty string.

## Context minimization

`buildContext(candidates, maxCandidates)` takes only the top N candidates (already ranked by real retrieval score) into the rendered context; the rest are recorded as `excludedDocumentIds` (still available for claim verification — see [claim-verification.md](claim-verification.md) — so a claim citing an excluded-by-minimization-but-genuinely-retrieved chunk isn't wrongly flagged as fabricated).

### Real comparison across context sizes

`scripts/verify-dgx-prototype-1-5.ts` step 19 runs the same real query through `CatalogueRagService.ask()` with `contextSize` set to 1, 3, 5, and 8, and records the real resulting confidence, source count, and claims-removed count for each. See that script's real console output (and [final-tuning-report.md](final-tuning-report.md)) for the exact numbers from this run.

The default remains 5 (`DEFAULT_CONTEXT_SIZE`) — the same width Baseline A effectively used (Prototype 1's `RagService.retrieveAndGenerate()` hardcoded top-5). This phase's real sweep did not find clear evidence that a different default size produces a decisively better groundedness/citation-correctness tradeoff on the current small evaluation sample; a larger real evaluation set (see [evaluation-baseline.md](evaluation-baseline.md)'s note on sample size) would be needed before confidently moving off 5.

## What this replaces

Prototype 1's context assembly concatenated all five retrieved chunks into one `Evidence:\n{{context}}` block with no internal structure. That undifferentiated-block approach is what this phase's context-builder replaces.
