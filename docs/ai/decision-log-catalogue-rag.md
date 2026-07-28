# DGX Prototype 1 — Catalogue RAG Decision Log

Short entries — the reasoning behind choices that weren't the only reasonable option. Same format as [docs/data-readiness/decision-log.md](../data-readiness/decision-log.md).

## Why only 2 new Prisma models were built, not the ~10 the original brief sketched

The brief's knowledge-document model proposed `KnowledgeDocument`, `KnowledgeDocumentVersion`, `KnowledgeChunk`, `KnowledgeSource`, `KnowledgeAccessPolicy`, `KnowledgeIngestionRun`, `KnowledgeIngestionError`, `KnowledgeApproval`, `KnowledgeSupersession`, `KnowledgeCitation`, plus index-lifecycle and relationship-graph tables. Reading Phase 4's actual schema first showed `KnowledgeDocument`/`KnowledgeChunk` already exist with `partId`/`lubricantProductId` FKs, `isApproved`, `confidence`, `sourceType` (including `PARTS_DOCUMENTATION`/`LUBRICANT_DOCUMENTATION`), and idempotent checksum-based dedup — already satisfying most of §7. Ingestion errors surface as `chunksFailed` on `EmbedDocumentResult`; approval is `KnowledgeDocument.isApproved`; citations are assembled at read time, not persisted. Only `CatalogueIndexVersion` and `PartRelationship` represented genuine gaps. This mirrors the exact "fold into existing fields, document why" discipline established in every prior phase of this project.

## Why `PartRelationship` excludes `FITS_VEHICLE`/`FITS_ENGINE`/`FITS_TRANSMISSION`

`PartCompatibility` (Phase 1) already models vehicle/engine/transmission fitment with its own confidence and source fields. Adding a parallel representation in `PartRelationship` would create two disagreeing sources of truth for the same real fact — the same anti-duplication principle applied throughout this project (e.g. reusing `WarehouseExternalReference` instead of building parallel mapping tables in the Data Readiness phase).

## Why catalogue-search identifier normalization is a separate module from `src/parts/normalize.ts`

`normalizeOemNumber()` is matching-critical — it decides whether two source records describe the same canonical part, and a permissive change there would silently start merging distinct real parts. `identifier-normalization.ts` only widens what a *search query* matches against; it's safe to be permissive there in a way it categorically is not safe to be permissive in matching logic. Kept as two files specifically so a future change to one can never accidentally affect the other.

## Why match-type ranking is a strict tier order, not a weighted score blend

A weighted blend is exactly the mechanism that would let a very high semantic-similarity score outrank a real exact OEM match — the spec explicitly forbids this outcome. `hybrid-ranking.ts`'s `MATCH_TYPE_PRIORITY` makes it structurally impossible: match type is compared before score, always.

## A real rate-limiting bug found by this phase's own first verification run

The first real corpus build (150 parts + 80 lubricants) reported 230 documents "indexed," but only 31 real `KnowledgeChunk` rows existed afterward — `AiGatewayService.embed()`'s real 30-req/60s rate limiter silently dropped ~200 embedding calls in a tight loop, and `KnowledgeBaseService.ingestDocument()` discarded the resulting `chunksFailed` count. Fixed by adding real client-side pacing (`paceEmbedCall()`, 2.1s minimum between calls) to `CatalogueIndexVersionService.buildIndex()` and surfacing a real `embeddingFailures` count on `BuildIndexResult`. The flawed index version was retired (not deleted — its documents remain as a historical record) rather than silently discarded. A second run (120 documents) completed with `embeddingFailures: 0`. See [vector-index-lifecycle.md](vector-index-lifecycle.md).

## A real evaluation-harness bug found by the same verification run

The first offline evaluation run measured `conflictDetectionAccuracy: 0`, `avgGroundedness: 0`, `avgCitationCorrectness: 0` — all three were bugs in `CatalogueEvaluationService`, not real system defects. The conflict test case was selected using "any multi-source part" instead of a genuine category-level conflict (592 of 898 real multi-source parts are brand-only differences, expected per the Data Readiness phase's own findings). The generation metrics compared against bare document-ID strings and the wrong (always-empty, deterministic-path-only) `matchingProducts` field instead of real retrieved chunk text and the real `sources` list. Both fixed; a re-run produced `conflictDetectionAccuracy: 1`, `avgGroundedness: 0.1999`, `avgCitationCorrectness: 1`. See [offline-evaluation.md](offline-evaluation.md).

## Why embedding-model and LLM-model comparisons are scoped to one real model each

`GET /v1/models` against the real local DGX service lists exactly `nomic-embed-text` and `llama3` — this environment simply does not have BGE/E5/GTE/Qwen or a second instruction model pulled. Rather than fabricate comparison numbers for models never actually run, both evaluation docs report the real single-model results and name the mechanical steps (`ollama pull <model>`, re-run the same harness) needed to extend the comparison later. See [embedding-model-evaluation.md](embedding-model-evaluation.md), [llm-model-evaluation.md](llm-model-evaluation.md).

## Why `citationCorrectness` in the offline evaluation validates a structural guarantee, not in-line citation parsing

`CatalogueRagService` never filters between "retrieved" and "cited" — every retrieved chunk handed to the LLM is listed in `sources`. This means the metric can only ever measure "no fabricated source ids," not "the LLM's free text explicitly referenced each one." Documented as a known limitation in [source-citations.md](source-citations.md) rather than presented as a stronger check than what was actually built.
