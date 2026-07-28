# Retrieval-Augmented Generation and AI Assistants

`src/rag/`, `src/knowledge-base/`, `src/ai-assistants/`. Core rule, enforced structurally rather than just documented: **the assistant answers only from approved knowledge, and never calls the LLM when there's nothing relevant to ground it in.**

## RagService — the shared engine

`RagService.retrieveAndGenerate()` is the one method every RAG-flavored feature goes through — plain chat/search (`answer()`) and every AI assistant (technician, manager) that needs free-text generation. The flow:

1. Embed the query (`AiGatewayService.embed()`, real `nomic-embed-text` vectors).
2. If embedding is unavailable, return `{available: false}` immediately — no fallback guess.
3. Semantic search over `KnowledgeChunk` (`VectorSearchService.semanticSearch()`), filtered to `isApproved: true` documents only.
4. **If zero hits, the LLM is never called.** The response is an explicit "I do not have enough verified information" — there is nothing to hallucinate an answer from, structurally.
5. If hits exist, build a context block citing each source, render the request's prompt template (via Prompt Registry), and call `AiGatewayService.generate()`.
6. Every response carries: retrieved sources (with excerpts and scores), a confidence band, a reasoning summary, an evidence ranking, missing-information notes, and a lexical grounding score (hallucination-monitoring signal — see [evaluation-framework.md](evaluation-framework.md)).

## A real bug this caught: hybrid scores aren't confidence scores

`VectorSearchService.hybridSearch()` min-max normalizes semantic+keyword scores across whatever candidates it returned — its top result is *always* ~1.0 by construction, regardless of how relevant that top result actually is. `RagService` originally used `hybridSearch()`'s output for confidence banding; an integration test asserting LOW/NONE confidence for a deliberately irrelevant query ("spaceship landing gear tyre pressure") instead observed a normalized 1.0 and failed. Fixed by switching `RagService` to `semanticSearch()` (real, un-normalized cosine similarity) for anything confidence-related — `hybridSearch()` is still used, and still useful, for the plain `/ai/search` ranking endpoint where relative ranking (not absolute confidence) is the point.

## Confidence thresholds are measured, not guessed

`src/rag/rag-confidence.ts`'s thresholds (`HIGH >= 0.65`, `MEDIUM >= 0.5`, `LOW > 0.4`) come from actually probing `nomic-embed-text`: a genuinely matching query scored `0.80` cosine similarity against its answer; completely unrelated queries ("chocolate cake recipe" against an ignition-coil procedure) still scored `0.33-0.46` — a real, measured baseline offset in this embedding model's space, not a 0-centered scale. A naive textbook 0.35 "medium" cutoff would have called that baseline noise medium-confidence evidence.

## Knowledge Base (`src/knowledge-base/`)

`KnowledgeDocument` carries the full metadata envelope the spec requires: source, version, publication date, confidence, copyright status, language, chunk-level embedding version, access permissions. **`isApproved` defaults to `false`** — a newly-ingested document is invisible to `RagService`/`VectorSearchService` until a human calls `approve()`. This is the literal implementation of "never allow AI to answer from unverified documents."

Ingestion (`KnowledgeBaseService.ingestDocument()`) chunks the content (`chunkText()`, paragraph-aware greedy packing), computes a SHA-256 checksum per chunk, and skips re-embedding any chunk whose `(documentId, checksum)` already exists — "do not embed duplicated records" enforced by both a DB unique constraint and an explicit pre-check (so a duplicate-content re-ingest costs one query per chunk, not one embedding call). `reindex()` re-embeds every chunk of a document and increments `embeddingVersion` — background re-indexing without re-chunking the source.

## AI Assistants — reuse over duplication, applied per-assistant

- **Technician Assistant** (`TechnicianAssistantService`) reuses `VehicleDigitalTwinService.getDigitalTwin()` and `RepeatRepairService.listForVehicle()` for case context, then calls `RagService.retrieveAndGenerate()` with a `TECHNICIAN_ASSISTANT` prompt scoped to workshop-manual/TSB/garage-history document types. The system prompt explicitly forbids declaring a confirmed diagnosis; the service also never writes to `DiagnosticSession`/`SuspectedCause` itself, so accepting a suggestion still requires a technician to record it through the existing Diagnostics module.
- **Parts Assistant** (`PartsAssistantService`) makes **no LLM call at all** — cross-references (`PartMatchCandidate`), alternative suppliers (`PurchaseDocumentLine`), stock availability (`InventoryLedgerService.getBalancesAcrossWarehouses()`), frequently-replaced-together (`GarageJobLine` co-occurrence), and the latest `PurchaseRecommendation` are all concrete structured facts already recorded elsewhere. Presenting a real cross-reference as an LLM-generated sentence would add hallucination risk to a fact that doesn't need it.
- **Lubricant Assistant** (`LubricantAssistantService`) also makes no LLM call — it returns only `LubricantCompatibility`/`LubricantApproval` rows that already exist. No matching compatibility record means an explicit empty result with a "no record found" note, never an invented viscosity grade. This is "never invent specifications," enforced structurally.
- **Manager Assistant** (`ManagerAssistantService`) deliberately bypasses `RagService`'s vector search — a manager's question needs live operational analytics (`InventoryAnalyticsService`, `WorkshopAnalyticsService`, `SupplierAnalyticsService`, `PurchaseRecommendationsService`, all reused verbatim), not documents. The evidence bundle is assembled from those real, already-computed numbers first; the LLM's only job is to summarize and answer in natural language from numbers it's given, never to invent a metric that isn't in the bundle.

## APIs

`/ai/chat`, `/ai/search` (`src/rag/rag.controller.ts`); `/ai/technician-assistant`, `/ai/recommend-parts/:partId`, `/ai/recommend-lubricant`, `/ai/recommend-purchase`, `/ai/manager-assistant` (`src/ai-assistants/ai-assistants.controller.ts`). `/ai/recommend-purchase` is a thin, read-only alias into Phase 2's existing `PurchaseRecommendationsService.list()` — no recommendation logic is duplicated for the sake of matching the spec's API list.
