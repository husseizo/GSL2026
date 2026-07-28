# Catalogue AI Integration — Additive Only

> **Update — DGX Prototype 1.7.2.** The `@Optional() knowledgeRetrieval` seam described below was confirmed, this phase, to be genuinely dormant in production: `CatalogueAiModule` never imported `KnowledgePlatformModule`, so Nest always injected `undefined` regardless of the env flag — "Nest injects `undefined` if the module tree doesn't provide it" was accurate, but nothing ever provided it. This phase's own new integration (`RetrievalPipelineService`, gated by `RETRIEVAL_INTELLIGENCE_ENABLED`) does not repeat that mistake — `CatalogueAiModule` and `KnowledgePlatformModule` now both really import `RetrievalIntelligenceModule` via `forwardRef()`, confirmed working by booting the full app. See [`docs/retrieval-intelligence/decision-log.md`](../retrieval-intelligence/decision-log.md). This existing `knowledgeRetrieval` seam itself is unchanged and still real code, just still not wired at the module level — a pre-existing gap this phase did not set out to close.

Per the spec's explicit "enhance, don't replace, exact product retrieval" instruction, this integration touches exactly one method in one existing file and changes zero behavior when disabled.

## The wiring

`CatalogueRagService` (`src/catalogue-ai/rag/catalogue-rag.service.ts`) gains a 9th constructor parameter: `@Optional() private readonly knowledgeRetrieval?: KnowledgeRetrievalService`. `@Optional()` means every existing caller or test that constructs this service without it is completely unaffected — Nest injects `undefined` if the module tree doesn't provide it.

Gated by `KNOWLEDGE_PLATFORM_CATALOGUE_INTEGRATION_ENABLED` (`shadow-mode.ts`'s `isKnowledgePlatformIntegrationEnabled()`), same pattern as the existing `CATALOGUE_RAG_GENERATION_ENABLED` flag — **default off**. Verified off-by-default by the verify script (step 41).

## What happens when enabled

Inside `answerFromRag()`'s existing context-building step, right after the real candidate-search loop and before `buildContext(candidates, contextSize)`, `KnowledgeRetrievalService.enrichContext()` is called and its results are **appended** to the existing `candidates` array — never reordering or replacing catalogue-search-derived candidates. Wrapped so a failure here never breaks the existing catalogue answer.

## What never changes

- `CatalogueSearchService` — zero changes.
- `ask()`'s deterministic-first routing — zero changes.
- Citation validation — Knowledge Platform citations flow through the existing `validateCitations()` machinery unmodified.

## Real, open risk

Every `VectorSearchFilter.sourceTypes` call site should be audited to confirm Knowledge-Platform-sourced document types are excluded from Catalogue AI's *default* retrieval path unless this flag is explicitly on — not yet independently re-audited this phase beyond the flag gate itself.
