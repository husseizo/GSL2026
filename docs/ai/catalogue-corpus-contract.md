# Catalogue Corpus Contract

## What gets embedded

`src/catalogue-ai/index-lifecycle/corpus-content-builder.ts` builds the exact text that gets embedded per record — a small, structured, non-transactional summary, never raw source rows.

**Spare parts** (`buildPartCorpusText`): product name, internal code, OEM number, alternate numbers, TecDoc identifier, brand, category/subcategory. No cost, no supplier pricing, no customer data.

**Lubricants** (`buildLubricantCorpusText`): product name, internal code, brand, category, viscosity, package size/unit, API/ACEA classification, verified OEM approvals. Every parsed-but-unverified technical field (viscosity, API, ACEA) is labeled directly in the embedded text as "(parsed, unverified unless stated otherwise)" — this is a deliberate choice so the string an LLM actually reads carries the caveat, not just a side-channel metadata flag a downstream consumer might drop.

## Eligibility classification before indexing

`src/catalogue-ai/corpus-eligibility.ts`'s `classifyIndexEligibility()` is a pure function returning one of: `INDEX_ELIGIBLE`, `INDEX_WITH_WARNINGS`, `MANUAL_REVIEW_REQUIRED`, `EXCLUDED_CONFLICT`, `EXCLUDED_LOW_QUALITY`, `EXCLUDED_MISSING_IDENTITY`.

Order of checks: missing canonical identity → no source provenance / no searchable content / inactive-historical / `RESTRICTED` access classification (all `EXCLUDED_LOW_QUALITY`) → a real category-level identity conflict (`EXCLUDED_CONFLICT`) → a brand-only conflict (`MANUAL_REVIEW_REQUIRED`, not excluded) → `INDEX_ELIGIBLE`.

The category-vs-brand distinction is load-bearing: real profiling from the Data Readiness phase found 592 real multi-source parts differ only by brand (expected — the same OEM cross-reference is legitimately manufactured by multiple aftermarket suppliers) versus 38 with a genuine category disagreement (a real identity error). Excluding every multi-source part outright would have thrown away the 592 legitimate ones; indexing every one as clean fact would have presented the 38 real errors as confirmed matches. `CatalogueIndexVersionService`'s private `classifyPart()` re-checks this signal live against `RawSourceRecord.rawPayload.part_group`, the same real conflict detector `CatalogueSearchService.hasRealConflict()` and the Data Readiness phase's `PartsQualityService.postValidateOemConsolidations()` use — one detector, three call sites, not three reimplementations.

`MANUAL_REVIEW_REQUIRED` records are still indexed (ingested with `isApproved: false`, `confidence: 0.6`), which means `VectorSearchService`'s `isApproved: true` filter correctly excludes them from semantic retrieval until a human approves them — this is the real mechanism behind spec §9's "conflict-aware review corpus... clearly marked," not a separate corpus table.

## Snapshot provenance

Every `CatalogueIndexVersion` optionally records a `dataSnapshotId` (FK to the existing `DataSnapshot` model from the Data Readiness phase). `scripts/verify-dgx-catalogue-rag.ts` step 3 always selects or creates one real, approved `DataSnapshot` before any corpus build.

## What was NOT built

The original spec sketched `KnowledgeSource`, `KnowledgeAccessPolicy`, `KnowledgeIngestionRun`, `KnowledgeIngestionError`, `KnowledgeApproval`, `KnowledgeSupersession`, `KnowledgeCitation` as separate tables. All of these were folded into existing fields: `KnowledgeDocument.source`/`sourceType`/`isApproved` already exist from Phase 4; ingestion errors are visible as `chunksFailed` on `EmbedDocumentResult` (see [vector-index-lifecycle.md](vector-index-lifecycle.md)); citations are assembled at read-time in `CatalogueRagAnswer.sources`, not persisted as a separate table (see [source-citations.md](source-citations.md)). See [decision-log-catalogue-rag.md](decision-log-catalogue-rag.md).
