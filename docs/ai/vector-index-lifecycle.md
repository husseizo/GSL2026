# Vector Index Lifecycle

## Blue-green, never in-place

`CatalogueIndexVersion` (`status`: `BUILDING` → `VALIDATING` → `EVALUATING` → `APPROVED` → `ACTIVE` → `ROLLED_BACK`/`RETIRED`) is never overwritten in place. `CatalogueIndexVersionService.activate()` retires whichever version currently holds `ACTIVE` (setting `RETIRED` + `retiredAt`) and only then flips the target version to `ACTIVE`. The retired version's `KnowledgeDocument` rows are never deleted — `rollback(indexVersionId, reactivateVersionId)` re-activates a prior version by the same blue-green flip, so a bad build can always be reverted without having lost the previous good one.

Every `KnowledgeDocument` created during a build is tagged with `indexVersionId`, so `validateIndex()` can independently confirm real documents and real chunks exist for a given version before it's ever approved.

## A real bug this phase's own first verification run caught

The first real run of `scripts/verify-dgx-catalogue-rag.ts` built an index over a 230-document representative sample (150 parts + 80 lubricants) and reported `partsIndexed: 150, lubricantsIndexed: 80` — but a post-run check of `KnowledgeChunk` counts showed only **31 real embedded chunks existed for all 230 documents**. Root cause: `AiGatewayService.embed()` is gated by `RateLimiterService` at a real 30-requests/60-second limit per actor (`rate-limiter.service.ts`), and `CatalogueIndexVersionService.buildIndex()`'s original implementation called `ingestDocument()` in a tight loop under one actor id — the first ~30 calls succeeded, and the remaining ~200 were silently rate-limited. `KnowledgeBaseService.ingestDocument()` discards the `chunksFailed` count from `EmbeddingService.embedDocumentContent()`, so nothing surfaced this at build time; only a direct query of `KnowledgeChunk` counts after the run revealed it.

This was a real finding from a real run, not a hypothetical — the flawed `CatalogueIndexVersion` (v1) was retired rather than deleted (its 230 documents remain in the database as a historical record of the flawed build), and the fix was applied directly to production code:

- `buildIndex()` now paces every embedding call via a private `paceEmbedCall()` (minimum 2.1s between calls, comfortably under the real 30/60s limit) instead of firing them as fast as possible.
- `BuildIndexResult` now returns a real `embeddingFailures` count — the number of documents that ended up with zero real embedded chunks — so a caller can never mistake "document row created" for "document is actually retrievable."
- A second real run with the fix, over a 120-document sample (80 parts + 40 lubricants), completed with `embeddingFailures: 0` — all 120 documents got at least one real embedded chunk, in 250.6 real seconds (~2.09s/document, matching the intended pacing).

See [decision-log-catalogue-rag.md](decision-log-catalogue-rag.md) for the full incident writeup.

## Retry is intentionally not implemented via re-ingestion

`KnowledgeBaseService.ingestDocument()` always creates a brand-new `KnowledgeDocument` row; retrying a failed embed by calling it again would create a duplicate document rather than fixing the original. `EmbeddingService.reindexDocument()` only re-embeds `KnowledgeChunk` rows that already exist — useless for a document whose first attempt failed before any chunk was ever created. Given the pacing fix above makes real failures rare, `buildIndex()` logs a warning and honestly counts a failure in `embeddingFailures` rather than papering over it with an incorrect retry path.

## Representative sampling, not the full catalogue

Real measured throughput (~2.1s/document, respecting the rate limiter) means a full real corpus (7,723 parts + 434 lubricants ≈ 8,157 items) would take on the order of 4.8 real hours to embed — impractical for a single verification run. Every verification run in this phase builds a controlled, honestly-labeled representative sample (documented in `scripts/verify-dgx-catalogue-rag.ts` itself) rather than either fabricating full-corpus numbers or silently truncating without saying so.
