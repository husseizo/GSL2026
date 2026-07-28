# DGX Prototype 1.7.2 — Retrieval Intelligence Platform Architecture

## Purpose

DGX Prototype 1.7.1 populated the Knowledge Platform with a real, legally-scoped corpus and surfaced a real, honestly-reported retrieval-quality ceiling: `KnowledgeRetrievalService.searchKnowledge()` had zero graph integration, zero structured-fact awareness, and a naive authority-only sort — a distinctively-worded SOP ranked at position 0, but a generically-titled TecDoc article competing against a much larger pre-existing catalogue vector index ranked around position 4. This phase builds a single, strategy-driven, explainable Retrieval Intelligence layer that both Catalogue AI and the Knowledge Platform consume internally, closing that gap — without redesigning either consumer's public contract, the Operational Core, or the Evaluation Framework's generic mechanics. This is the final AI Foundation phase: no new AI capability begins until this reaches `RETRIEVAL_FOUNDATION_READY`.

## Component map

```
Query ──▶ query-understanding/          (normalize, detect language, classify into 21 classes, extract entities)
              │
              ▼
       strategy/strategy-selector.ts     (queryClass -> which of 13 strategies + which of 10 hybrid modes)
              │
              ▼
       pipeline/retrieval-pipeline.service.ts   (orchestrates all 16 stages)
        ├─ candidate generation: CatalogueSearchService (exact OEM/internal-code/alternate/TecDoc lookup,
        │                         all pre-existing, unmodified) + real KnowledgeItem key/title lookup
        │                         + VectorSearchService.hybridSearch() (real embedding via AiGatewayService)
        ├─ graph expansion:      GraphExpansionService wraps the existing, unmodified
        │                         KnowledgeGraphService.traverse() — additive only, never before
        │                         candidate generation completes
        ├─ conflict awareness:   real KnowledgeConflict lookups, feeds the CONFLICT_STATUS ranking signal
        ├─ freshness validation: reuses KnowledgeLifecycleService.classifyFreshness(), hard-excludes EXPIRED
        ├─ ranking:              ranking/ranking-engine.ts — 15 real signals -> score + explanation
        └─ evaluation logging:   RetrievalQueryLogService persists every real run (RetrievalQueryLog)
              │
              ▼
       RetrievalResult { queryClass, language, strategyMode, candidates[], confidence, conflicts, snapshotId }
```

## Wiring into consumers — additive, feature-flagged, contracts unchanged

- `CatalogueAiController`'s 11 public routes and `CatalogueRagAnswer`'s shape: **byte-for-byte unchanged**.
- `KnowledgeRetrievalService.searchKnowledge()`'s `AiConsumerRequest`/`AiConsumerResult` contract: **unchanged**.
- Both `CatalogueRagService` and `KnowledgeRetrievalService` gained a new, `@Optional()` `RetrievalPipelineService` constructor dependency (wired via `forwardRef()` since `RetrievalIntelligenceModule` itself imports `CatalogueAiModule`/`KnowledgePlatformModule` for their existing services — a real, working circular-module resolution, confirmed by booting the full app). Both call sites are gated by `RETRIEVAL_INTELLIGENCE_ENABLED` (env flag, default off until the real quality gates pass) and wrapped in try/catch so a Retrieval Intelligence failure never breaks the existing answer path.
- **A real, pre-existing bug found and fixed this phase**: `KnowledgeRetrievalService`'s `@Optional() KnowledgeRetrievalService` dependency inside `CatalogueRagService` (from DGX 1.7) was documented as "Nest injects `undefined` if the module tree doesn't provide it" — and indeed, `CatalogueAiModule` never imported `KnowledgePlatformModule`, so that seam was dormant in production regardless of its env flag. This phase's own new `RetrievalPipelineService` wiring does NOT repeat that mistake: the module graph is genuinely connected (see decision-log.md).

## Deliberately unmodified

`hybrid-ranking.ts`'s `MATCH_TYPE_PRIORITY` tier guarantee; `VectorIndexProvider` interface (still `PostgresArrayVectorIndexProvider`, no pgvector/Qdrant migration this phase); `KnowledgeSnapshotService`'s blue-green state machine; `KnowledgeItemRegistryService`'s append-only versioning; DGX 1.6's `quality-gates.ts` and DGX 1.7.1's `trusted-knowledge-quality-gates.ts` (both untouched — this phase adds a third, separate evaluator, `retrieval-intelligence-quality-gates.ts`).

## See also

[query-classification.md](query-classification.md), [ranking.md](ranking.md), [hybrid-retrieval.md](hybrid-retrieval.md), [decision-log.md](decision-log.md), [final-report.md](final-report.md).
