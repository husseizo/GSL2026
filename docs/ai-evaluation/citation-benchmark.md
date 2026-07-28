# Citation Benchmark — DGX Prototype 1.6 (spec §13)

## Design decision

Like Hallucination (see `hallucination-benchmark.md`), Citation is not a top-level `BenchmarkCategory` but a dedicated `CitationSubScore` nested inside `GENERATION`'s `CategoryMetrics` — independently reported, never blended into a single generation number.

## Reused, not reimplemented

`computeCitationSubScore()` (`src/ai-benchmark/categories/citation-cases.ts`) is a pure aggregation function that calls the already-existing `citationCorrectness()`/`citationCompleteness()` (both real, in `src/catalogue-ai/evaluation/generation-metrics.ts` — `citationCompleteness()` in particular already existed before this phase, contrary to an earlier planning assumption that it needed to be built) and `validateCitations()` (`src/catalogue-ai/rag/citation-validator.ts`) — none of that logic is duplicated here.

## What's measured

`correctness`/`precision` (of everything cited, how much was a real retrieved source), `completeness`/`recall` (of material real sources, how many were actually cited), plus three real counts: `brokenCitationCount` (a cited id that doesn't resolve to anything), `wrongCitationCount` (cited but not retrieved — a fabricated-looking citation), `missingCitationCount` (a material source that went uncited).

## Not a separately-authored case pool

Per the honest dataset-scale plan (`gold-dataset.md`), citation quality rides on top of whatever generative answers already exist from OTHER categories — every generative answer's citations are checkable. A small number of dedicated multi-source stress-test cases (`buildCitationStressCases()`) are added on top: real parts/lubricants with more than one real approved `KnowledgeDocument`, since citation completeness is only meaningfully testable when multiple real sources actually exist to (under-)cite — for a single-source answer, completeness is trivially 1.0 by construction.

## Real test coverage

`citation-cases.spec.ts` (pure, no DB): zero samples returns perfect scores rather than dividing by zero; a real wrong citation is flagged via `wrongCitationCount`; a real missing citation is flagged via `missingCitationCount`.

## Known limitation, carried over honestly from Prototype 1.5

`citationCorrectness()`/`citationCompleteness()` validate a structural guarantee (`ragAnswer.sources` IS the real retrieved set) — not that the model's free-text answer explicitly named each cited source in-line. Real in-line citation-marker parsing is not implemented this phase either; see `docs/ai-tuning/citation-quality.md` for the original documentation of this gap, unchanged here.
