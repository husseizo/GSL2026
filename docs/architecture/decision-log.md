# Decision Log

Short entries — the reasoning behind choices that weren't the only reasonable option. Longer rationale lives in the linked doc.

## Why inventory uses a ledger, not a mutable quantity
A single quantity column can't explain itself, can't be replayed to detect drift, and can't be made idempotent against duplicate imports. Every event is an immutable `InventoryMovement`; the balance is a maintained projection. See [inventory-ledger.md](inventory-ledger.md).

## Why recommendations are rule-based first
The formulas (reorder point, target stock, suggested quantity) are specified exactly in the brief, and Phase 2 has no forecasting history to train anything on yet. A deterministic engine is auditable — every number in `evidence` traces back to a real DB value — where an ML model at this stage would just be an unauditable black box fit to a handful of sample rows. See [purchase-recommendation-engine.md](purchase-recommendation-engine.md).

## Why AI is not required for Phase 2
No DGX Spark access from this environment, no historical volume yet to backtest a forecast against, and the deterministic engines already answer the phase's stated questions (what to buy, what's dead, what's at risk) without it. See [03-ai-platform.md](03-ai-platform.md) — Phase 2 explicitly stops short of AI/ML by design, not by omission.

## Why approval is separated from execution
Applied uniformly: `PurchaseRecommendation`/`TransferRecommendation` approval only records a decision, never creates a real PO or moves stock. `InventoryAdjustment` is two-step (`create()` records intent, `approve()` posts the movement). `StockTransfer` similarly separates `create()` (intent) from `approve()` (stock leaves source) from `receive()` (stock lands at destination). One principle, applied at every point where an automated system could otherwise take an irreversible action unsupervised.

## Why sales logs are treated as demand evidence
An `INVOICE`/`DELIVERY`/`COUNTER_SALE` line, once it reaches AIOS from the legacy POS, already represents stock that left the building — AIOS isn't yet the system of record (see [00-overview.md](00-overview.md)'s phased-migration principle), so the ledger has to be built retroactively from what the legacy system already did, not from a fresh transaction AIOS is being asked to authorize. That's why importing a sales document posts an inventory movement but importing a purchase order does not (a PO is a future intent; a completed invoice is a past fact).

## Why unresolved item/customer/supplier references are preserved, not rejected
Rejecting a sales line because its item code doesn't resolve would silently drop real transaction history — exactly the kind of demand signal Phase 2 exists to capture. Instead the record is created with `unresolvedItemCode`/`unresolvedCustomerRef` set and a `MANUAL_REVIEW` data-quality issue raised, so the transaction is visible and a human can reconcile it later. See [data-quality-phase-2.md](data-quality-phase-2.md).

## Why source updates are checksum/version based
Same mechanism as Phase 1 (Vehicle/Part): a document/line's checksum only changes if its content did, so cursor replay after a crash is a no-op and a genuine correction is applied exactly once. Extended in Phase 2 with a **per-line** checksum in addition to the whole-document one, so a correction to a single line doesn't force-rewrite its unchanged siblings.

## Why a corrected sales line does not auto-adjust the ledger
If a line's quantity changes after its `SALE_ISSUE` movement already posted, there's no way to tell from the source data alone whether the correction is a full replacement or a delta — silently reposting a "corrected" movement risks double- or under-counting. The line updates; the ledger doesn't; a `MANUAL_REVIEW` data-quality issue is raised so a human applies an explicit `InventoryAdjustment` instead.

## Why one `AppEvent` table, not four
`AppEvent`/`SearchEvent`/`ProductInteractionEvent`/`TransactionFailureEvent` would all share the same columns, differing only in which `WHERE eventType = ...` a query happens to use. A single discriminated table with a `metadata` JSON column for kind-specific extras avoids four near-identical schemas and four near-identical services.

## Why the `itemKey` surrogate exists
Postgres unique indexes treat NULL as distinct-from-NULL, so `@@unique([partId, lubricantProductId, warehouseId])` would not actually stop duplicate balance rows for the same item (one of the two FK columns is always NULL). A non-null computed surrogate (`part:<id>` / `lubricant:<id>`) is the unique key instead. See [inventory-ledger.md](inventory-ledger.md) for the full explanation, including why the *same* NULL-distinct behavior is correct and intentional for `Vehicle`/`Part`/`Customer`'s sync-envelope uniqueness.

## Why RBAC permissions are a static code map, not a DB table
Phase 2 doesn't need runtime-editable permissions — a fixed map in `role-permissions.ts` is trivially auditable by reading one file, with no admin UI or migration needed to change a grant during development. A DB-backed permission-management system is a reasonable Phase 3+ addition if role/permission assignments need to change without a deploy.

## Why audit logging is explicit calls, not a global interceptor
An interceptor that "magically" audits every mutation is opaque — you can't tell what's audited without reading the interceptor's matching rules. Explicit `AuditService.log()` calls at the specific points the spec lists (customer update, inventory adjustment approval, lost-sale review, recommendation decisions) make the audit surface visible in the code that does the mutating, and testable in isolation (see `audit.integration-spec.ts`).

## Why `ItemPlanningProfile` is a separate model from `Part`/`LubricantProduct`
Safety stock, MOQ, package quantity, coverage targets, and criticality are operational tuning knobs the purchasing team adjusts, not catalog attributes describing what the item *is*. Keeping them in their own table, keyed by the same `itemKey` surrogate used throughout the ledger, means the parts/lubricants catalogue doesn't get cluttered with purchasing-specific columns, and the recommendation engine has one clear place to look for its non-demand inputs.

## Why `LubricantAlternative` reuses `MatchCandidateStatus`
It's the same shape as Phase 1's `PartMatchCandidate`: a proposed relationship between two catalogue items that a human must approve before it's trusted. Reusing the enum (`PENDING`/`APPROVED`/`REJECTED`) instead of inventing a parallel one keeps "propose, don't auto-merge" a single well-understood pattern across both catalogues.

## Why Phase 4 uses Ollama instead of a bespoke inference runtime
Ollama was already installed and running on this machine with two real models pulled (`llama3`, `nomic-embed-text`) — verified before writing any Phase 4 code. It's also NVIDIA's own recommended way to run local models on a real DGX Spark, so the exact same code (`services/dgx-ai-platform`) needs zero changes to move from this CPU-only sandbox to actual GPU hardware — only `OLLAMA_BASE_URL` changes, and GPU acceleration + `/v1/health`'s `nvidia-smi` probe both activate automatically. See [dgx-platform.md](dgx-platform.md).

## Why vector search runs on a plain Postgres array, not pgvector
`pg_available_extensions` was queried directly against this environment's portable PostgreSQL 16 build before deciding — `pgvector` isn't available, and compiling it against this exact build isn't practical here. Rather than block Phase 4 on infrastructure that doesn't exist, `KnowledgeChunk.embedding` is a `Float[]` column with cosine similarity computed in application code, behind a `VectorIndexProvider` interface designed so a real pgvector/Qdrant/Milvus backend is a DI binding change later, not a rewrite. See [vector-search.md](vector-search.md).

## Why RAG confidence uses `semanticSearch()`, not `hybridSearch()`
`hybridSearch()`'s merged score is min-max normalized across whatever candidates it returned, so its top result is always ~1.0 regardless of true relevance — a genuine bug, caught by an integration test asserting low confidence for a deliberately irrelevant query and instead observing a normalized 1.0. Raw cosine similarity from `semanticSearch()` is the only score with real absolute meaning, which confidence banding needs. See [rag-architecture.md](rag-architecture.md).

## Why Parts/Lubricant assistants never call the LLM
Cross-references, stock availability, and OEM approvals are concrete facts already recorded in Phase 1/2/3 tables. Wrapping a real fact in an LLM-generated sentence adds hallucination risk to something that doesn't need it — these two assistants only assemble and cite what's already recorded, structurally incapable of inventing a specification or a cross-reference that isn't in the database.

## Why AI purchasing signals are additive-only, never a decision input
`computePurchaseRecommendation()` (Phase 2's fixed formula) is completely untouched by Phase 4. `AiPurchasingSignalsService` only attaches supplementary, cited evidence (forecast, repeat-repair count, search-demand count) to the recommendation's `evidence` JSON after the action/quantity is already final — "AI never places purchase orders" is enforced by there being no code path from the AI signal back into the decision, not just by a policy statement.
