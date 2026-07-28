# DGX Prototype 1.7 — Decision Log

Short entries — the reasoning behind choices that weren't the only reasonable option. Same format as [docs/ai-evaluation/decision-log.md](../ai-evaluation/decision-log.md) and the phases before it.

## Two decisions confirmed with the user during planning

1. **Portal UI**: backend/API + CLI only this phase. The spec's 19-screen internal Knowledge Portal is explicitly deferred and documented (`portal-ui-deferred.md`), never half-built. Completion criteria never required the UI to exist, only the underlying capabilities.
2. **Benchmark taxonomy**: exactly one new `BenchmarkCategory` value, `KNOWLEDGE`, added to the existing `src/ai-benchmark` enum — nests 7 sub-scores (retrieval, supersession, applicability, authority-ranking, expired/restricted-exclusion, graph-relation, structured-fact-extraction), mirroring exactly how Hallucination/Citation ride as sub-scores inside `GENERATION` rather than becoming new top-level categories.

## Why one `KnowledgeSource` table, not ~10 sub-entities

The spec's source registry lists roughly ten conceptually distinct things (license terms, access classification, contact info, update frequency...). None of them has an independent lifecycle or query pattern that justifies its own table — they collapse into JSON/string fields on a single `KnowledgeSource` row, matching the existing `KnowledgeDocument.accessPermissions: Json?` precedent already in this codebase.

## Why one `StructuredFact` table with a `factType` discriminator, not 14 tables

Every one of the spec's 14 named fact types (torque spec, fluid capacity, fitment, warranty term...) shares the identical real shape: value/unit/conditions/applicability/source/confidence. Fourteen near-identical tables would multiply migration and test surface for zero behavioral gain. `extractedBy` (`MANUAL_ENTRY | PARSER_DETERMINISTIC | LLM_ASSISTED_FLAGGED_FOR_REVIEW`) is the real, structural mechanism enforcing "never rely on an LLM summary for torque/fluid/safety/fitment data" — see `structured-facts.md`.

## Why four separate applicability junction tables, not one cross-product table

`KnowledgeItemVehicleApplicability`, `...PartApplicability`, `...EngineApplicability`, `...FaultCodeApplicability` are each independently indexed `(itemId, targetKey)` pairs, deliberately not joined into a single cross-product table — that would combinatorially explode for items applicable across many vehicles × parts × engines. The tradeoff: no DB constraint can enforce cross-dimension consistency; this is service-layer convention only, named explicitly as a real, accepted risk.

## Why `KnowledgeGraphNode`/`KnowledgeGraphEdge` are 2 tables, not one per node type

Per the user's explicit instruction to prefer Postgres relationships and avoid premature graph-database complexity, the graph is 2 tables using the same `entityType`/`entityId`-by-convention polymorphic-reference pattern `AuditLog` already uses (`nodeType`/`refId` here). `traverse()` is deliberately capped at `MAX_TRAVERSAL_DEPTH = 4`, bounded-depth BFS only — no shortest-path/PageRank-style ranking, a named ceiling to avoid scope creep.

## Why `KnowledgeSnapshot` is a new, separate model — not a reuse of `CatalogueIndexVersion`

Same proven build→validate→evaluate→approve→activate→rollback state machine shape as `CatalogueIndexVersionService`, but `CatalogueIndexVersion` is hard-coded to iterate `Part`/`LubricantProduct` and cannot host procedures/policies/TSBs without becoming a different thing. A parallel model was safer than bending an existing, working, differently-scoped one.

## A real gap found mid-build: the graph had no lubricant-approval relationship

The initial `KnowledgeGraphNodeType`/`KnowledgeGraphEdgeType` enums (`KNOWLEDGE_ITEM/VEHICLE/PART/ENGINE/FAULT_CODE/PROCEDURE_STEP/KNOWLEDGE_SOURCE` and `APPLIES_TO/SUPERSEDES/CONFLICTS_WITH/DERIVED_FROM/REFERENCES/CAUSED_BY/RESOLVED_BY`) had no way to represent "this lubricant is approved for this part/vehicle" — a relationship the spec names explicitly. Fixed via a second, purely additive migration (`20260717231324_knowledge_graph_lubricant`) adding a `LUBRICANT` node type and `HAS_APPROVAL`/`USES_LUBRICANT` edge types, applied to both the dev and test databases.

## A real gap found mid-build: `AiBenchmarkModule` never imported `KnowledgePlatformModule`

`BenchmarkPipelineService` gained a new, non-optional constructor dependency on `KnowledgeRetrievalService` (for `runKnowledgeCategory()`), but `AiBenchmarkModule`'s `imports` array was never updated to bring `KnowledgePlatformModule` into scope. This would have crashed app bootstrap with an unresolved-dependency error the first time anything tried to instantiate `BenchmarkPipelineService`. Found by actually booting the app via the verify script rather than assumed safe from `tsc` alone (`tsc` cannot catch a NestJS DI wiring gap). Fixed by adding the import.

## Real bugs found by the verify script's own first live runs, fixed

1. **Lint**: `document-injection-scanner.ts`'s control-character-stripping regex trips `no-control-regex`. Fixed the same way the existing `prompt-sanitizer.ts` already handles the identical, legitimate pattern — a scoped `eslint-disable-next-line`, not a rule change.
2. **Verify-script bug, not a service bug**: the claim-provenance check (step 22) compared every claim's `evidenceQuote` against the *original* ingested content, but the same item had since gained a second version with additional content — any claim extracted from the newer version's added sentence correctly failed a substring check against the older content. Fixed by filtering claims to the specific version under test.
3. **Verify-script bug, not a service bug**: the supersession check (step 29) reused an item key that already had a real `DRAFT` v2 sitting in the database from an earlier dedup/version-detection fixture, so `supersede()`'s real `version = latest + 1` computation collided with it (`Unique constraint failed on (itemId, version)`) — the append-only versioning worked exactly as designed; the test fixture was the defect. Fixed by giving the supersession fixture its own dedicated item.
4. **Verify-script bug, not a service bug**: the snapshot-rollback check (step 38) tried to reactivate a snapshot that had just been demoted to `RETIRED`, but `KnowledgeSnapshotService.rollback()` — an intentional, exact mirror of `CatalogueIndexVersionService.rollback()`'s existing, already-accepted semantics — only reactivates a still-`APPROVED` (never-yet-activated) candidate. Fixed the test scenario to match the real, pre-existing precedent rather than changing the service.

## A real, honest limitation, not a bug: `CONFLICT_DETECTION`/`PROMPT_INJECTION` categories did not gain knowledge-specific case generators

The plan called for feeding the existing `CONFLICT_DETECTION`/`PROMPT_INJECTION` `ai-benchmark` categories with Knowledge-Platform-sourced cases (in addition to the new dedicated `KNOWLEDGE` category). That integration was not built this phase — confirmed by grep, not assumed. The new `KNOWLEDGE` category's own conflict/injection-adjacent sub-scores (`expiredRestrictedExclusion`, etc.) are real and tested; the cross-pollination into the two pre-existing categories is not. Named here rather than silently claimed. See `evaluation-framework-integration.md`.

## No new Prometheus metrics added this phase

Confirmed by grep — zero `record*()` methods were added to `observability/metrics.service.ts` for Knowledge Platform events (ingestion counts, quarantine counts, publish counts). The existing generic `aios_http_requests_total`/`aios_http_request_duration_seconds` metrics (applied unconditionally via `observability/metrics.middleware.ts`) automatically cover every new controller route for free, and `AuditLog` gives a full, queryable mutation trail — but no dedicated business-event metric exists yet. See `monitoring-metrics.md`.

## The machine restart mid-build

Partway through this phase, the shared development machine was restarted externally, taking down the portable Postgres instance, the DGX FastAPI proxy, and the backend dev server simultaneously. Real WAL-based crash recovery on Postgres's own restart handled everything automatically — no data was lost, confirmed via row counts and `prisma migrate status` reporting all 14 (now 15) migrations still applied. Not a Knowledge Platform defect, but a real operational event during this phase's timeline, worth recording for continuity.
