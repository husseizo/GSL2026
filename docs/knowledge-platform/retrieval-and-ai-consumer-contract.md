# The AI-Consumer Contract

> **Update — DGX Prototype 1.7.2.** `AiConsumerRequest`/`AiConsumerResult` are **unchanged** — still the exact same contract shape. Internally, `searchKnowledgeInternal()` gained real fixes this phase: `knowledgeDomains` and `vehicleContext.partId` (previously accepted but never used) now really filter/widen results; a real no-op bug in `allowConflicts` (both branches of a ternary returned the same value) is fixed — conflicted items are now genuinely excluded when `allowConflicts` is false; and an additive, feature-flagged (`RETRIEVAL_INTELLIGENCE_ENABLED`, default off) real re-ranking pass via the new `RetrievalPipelineService` adds graph/structured-fact-aware signals on top of the existing authority-rank sort. See [`docs/retrieval-intelligence/architecture.md`](../retrieval-intelligence/architecture.md) and [`decision-log.md`](../retrieval-intelligence/decision-log.md).

Every future AI consumer (Catalogue AI, Demand Forecasting, Predictive Maintenance, Technician Copilot, Management Assistant, Customer Service Assistant) reads governed knowledge only through `KnowledgeRetrievalService.searchKnowledge()` — never a direct Prisma query against `KnowledgeItem*`/`StructuredFact`. See `src/knowledge-platform/retrieval/knowledge-retrieval.service.ts`.

## Real request/result shape

`AiConsumerRequest`: `consumerName`, `consumerVersion`, `purpose`, `query`, plus optional `knowledgeDomains`, `maxAuthorityLevel`, `allowConflicts`, `allowHistoricalVersions`, `vehicleContext`.
`AiConsumerResult`: `retrievedItemIds`, `retrievedVersionIds`, `citations` (item/version/title/source/authority/publishedAt), `conflicts` (open `KnowledgeConflict` ids, never silently resolved), `exclusions` (itemId + real reason), `confidence`, `freshness`.

## The real exclusion/ranking pipeline — deterministic, never LLM-decided

1. Only documents materialized from a `PUBLISHED` `KnowledgeItemVersion` (`isApproved`-gated, the same mechanism `VectorSearchService` already enforces) are candidates.
2. `EXPIRED` versions are always excluded.
3. `WITHDRAWN`/`SUPERSEDED` versions are excluded unless the caller explicitly sets `allowHistoricalVersions`.
4. A version whose `authorityLevel` exceeds the caller's `maxAuthorityLevel` is excluded (`AUTHORITY_LEVEL_EXCEEDS_MAX`).
5. A version whose source is `RESTRICTED` and not `allowedAiUse` is excluded (`RESTRICTED_ACCESS_AI_NOT_ALLOWED`) — see `security-encryption-access.md`.
6. Surviving results are sorted by real authority rank (`authority-hierarchy.md`), never relevance-only.
7. Any open `KnowledgeConflict` touching a returned item is surfaced in `conflicts`, never silently picked one way.

Verified end-to-end by the verify script (step 33: real citations returned with real exclusions/authority ranking) and by the integration spec (expired-version exclusion with real citations).

## Additive Catalogue AI integration point

`enrichContext(targets)` returns zero or more real context candidates sourced from published, AI-consumer-visible `StructuredFact`s applicable to a given part/vehicle — designed to be appended, never substituted, into `CatalogueRagService`'s existing candidate list. See `catalogue-ai-integration.md`.

## Real, honest closing principle

Matching the spec's own words: the platform must prefer no answer, an explicit conflict, an expired-status warning, or a restricted-access exclusion over serving an uncontrolled or unsupported technical fact. Every exclusion reason above is a concrete implementation of that principle, not an aspiration.
