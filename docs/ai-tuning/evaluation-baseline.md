# Baseline A — Frozen Pre-Tuning Snapshot

Captured 2026-07-13, immediately before any Prototype 1.5 tuning change (ranking weights, prompts, context construction, claim verification) was made. Every number below is real, measured against the live system in this state — nothing is estimated or carried forward from memory.

## Code / environment

- **Git commit**: none exists — this repository has zero commits (`git log` reports "your current branch 'master' does not have any commits yet"). Anchoring baseline to real runtime state instead: `CatalogueIndexVersion` v3's `corpusChecksum` (`65237b25...feb9e0ea`) and this document's timestamp are the reproducibility anchor until a first commit exists.
- **Corpus snapshot**: `DataSnapshot` id `e3662f67-46a6-40f3-a4eb-b6470f37548d`.
- **Index version**: `CatalogueIndexVersion` v3 (id `05ac0196-ffe2-4d13-8e23-22efa30b75d9`), status `ACTIVE`, built `2026-07-13T15:09:02.374Z`, approved `2026-07-13T15:13:16.890Z`. 80 parts + 40 lubricants indexed (120 documents); exclusions: 116 `INDEX_ELIGIBLE`, 4 `MANUAL_REVIEW_REQUIRED`, 0 excluded.
- **Embedding model**: `nomic-embed-text:latest`, `AiModel.status = ACTIVE`, `isDefault = true`.
- **Generator model**: `llama3:latest`, `AiModel.status = ACTIVE`, `isDefault = true`.
- **Prompt version**: `CATALOGUE_RAG_ANSWER` template, `PromptVersion` v1 (id `b7bd1c8b-880b-40c3-829a-9a687c323256`), `temperature: 0.1`, `maxTokens: null` (model default), `isActive: true`, published `2026-07-13T12:12:52.670Z`. Full system prompt and user template text preserved verbatim in this doc's git history / the `PromptVersion` row itself — never edited in place going forward (Prototype 1.5 publishes new versions, never mutates this one).
- **Reranking configuration**: none — Baseline A has no reranking stage; ranking is `hybrid-ranking.ts`'s strict match-type tier order with score as same-tier tiebreaker only (see [retrieval-optimization.md](retrieval-optimization.md)).
- **Retrieval limits**: `VectorSearchService.semanticSearch(embedding, 5, filter)` — top 5 chunks, hardcoded in `RagService.retrieveAndGenerate()`.
- **Context limits**: no explicit token budget or evidence-quality filter — every one of the top-5 retrieved chunks is concatenated into the prompt unconditionally (see [context-optimization.md](context-optimization.md) for what Prototype 1.5 changes here).
- **Evaluation dataset version**: `CatalogueEvaluationService.buildEvalSet(20)` — 28 real, self-consistency-based cases (20 `EXACT_OEM`, 5 `FORMATTED_OEM_VARIATION`, 1 `CONFLICT`, 1 `NO_ANSWER`, 1 `AMBIGUOUS`).
- **Hardware / concurrency**: CPU-only (`gpuAvailable: false`, `mode: "cpu"`), real Ollama 0.31.1. `RateLimiterService`: 30 requests/60s per actor. Embedding pacing: 2.1s minimum between calls (`CatalogueIndexVersionService.paceEmbedCall()`). Generation timeout: 180s (`DgxClientService.generate()`). Embed timeout: 60s. Health-check timeout: 5s.
- **Corpus totals**: 7,723 real parts (`PARTS_CATALOG_AUTOHUB`), 434 real lubricant products (`MOLAS_CACHE_LUBRICANTS`) — full catalogue; 120 indexed in the active sample.

## Baseline A metrics

**Retrieval** (28 cases): Recall@1 = 1.0, Recall@3 = 1.0, Recall@5 = 1.0, MRR = 1.0, nDCG@5 = 1.0, exact-number preservation = 1.0, no-answer precision = 1.0, conflict-detection accuracy = 1.0.

**Generation** (3 cases exercising the generative path): groundedness = 0.1838, citation correctness = 1.0 (structural guarantee, see [citation-quality.md](citation-quality.md)), unsupported-claim rate = 0.5, structured-output validity = 1.0.

**Operational** (from the Prototype 1 Final Acceptance Report, same index/model state, not re-measured here to avoid redundant real DGX load — see that report for the underlying samples): deterministic search P50/P95/P99 ≈ 15.0ms/18.4ms/19.5ms; generative endpoint 43.3s-63.4s under concurrent load (contended, not a clean baseline).

## Why this specific run is "Baseline A," not just "a run"

This is the same evaluation harness, same eval-case-generation call, same active index, same prompt version, same model versions used throughout Prototype 1's final acceptance pass — captured fresh, immediately before this phase's first tuning change, specifically so every later "tuned" number in this phase's final report can be compared against a real, contemporaneous, frozen reference rather than an older number from a different session. No tuning result in this phase's final report may be accepted without a side-by-side comparison against these exact numbers.
