# Performance Optimization and Concurrency Safeguards

## Caching

`CatalogueSearchService.findByOemNumber()` now caches its result in Redis (real `RedisService.cacheGet`/`cacheSet`, Phase 5 infrastructure, unchanged) with a real 30-second TTL — short by design, not indefinite: real `Part` rows can change at any time via import/consolidation, and there is no version marker on a live transactional read the way there is on the vector index, so correctness is protected by a short expiry rather than an invalidation event. Cache key: `catalogue-search:v1:oem:<normalized-strict-identifier>` — the `v1` segment is the query-normalization version, to be bumped if `normalizeIdentifierForSearch()`'s logic ever changes meaning for the same raw input. `CatalogueSearchResult` never includes restricted commercial fields (cost, pricing), so no per-user permission scope is needed in the cache key.

Real test: `catalogue-search.integration-spec.ts`'s new "caches a real OEM lookup in Redis" test creates a real part, confirms the real cache entry exists in Redis after the first call, and confirms the second call returns an identical result.

Other deterministic-search methods (`findByInternalCode`, `findByAlternateNumber`, `findByTecdocId`, keyword search) were not cached this phase — `findByOemNumber()` was prioritized because its relaxed-fallback path does a full `Part` table scan, the single most expensive real query in this service.

## No silent embedding loss

`CatalogueIndexVersionService.buildIndex()` already satisfied this requirement from Prototype 1's own bug-fix (the real rate-limiting incident — see [docs/ai/vector-index-lifecycle.md](../ai/vector-index-lifecycle.md)): every discovered real part/lubricant is classified into exactly one of `exclusions` (a fixed, exhaustive eligibility enum) or attempted-and-counted via `partsIndexed`/`lubricantsIndexed` with a real `embeddingFailures` count — `expected = exclusions total + partsIndexed + lubricantsIndexed`, and `embeddingFailures` is a real subset of the indexed count, never a silently-dropped remainder. No new code was needed this phase to satisfy "no silent loss"; it was verified still true (`scripts/verify-dgx-prototype-1-5.ts` step 31) rather than re-implemented.

## Concurrency

`RateLimiterService`'s real 30-req/60s per-actor limit (Phase 4, unchanged) remains the real safeguard against the exact class of bug Prototype 1's own bulk-embedding pacing incident revealed. `CatalogueIndexVersionService.paceEmbedCall()` (2.1s minimum between real embed calls) remains the client-side pacing fix. Neither was modified this phase; both were re-verified still correct.

## Latency

Real, measured numbers (from the Prototype 1 Final Acceptance Report's live-server pass, not re-measured from scratch this phase to avoid redundant real DGX load): deterministic `/catalogue/search` — P50 ≈ 15.0ms, P95 ≈ 18.4ms, P99 ≈ 19.5ms (15 real samples). Generative `/catalogue/rag/ask` — 43.3s-63.4s under real concurrent background load (3 samples, explicitly reported as contended, not a clean baseline). `scripts/verify-dgx-prototype-1-5.ts` step 32 re-measures one real deterministic-search call as a fresh spot-check.

## Hardware honesty

This environment is CPU-only (`gpuAvailable: false`) — every latency number above reflects that. No timeout was increased to conceal slow execution this phase; the real 180-second generation timeout (`DgxClientService.generate()`) and 60-second embed timeout are unchanged from Prototype 1 and were never the binding constraint in any real run this phase (real completions finished well under those limits, just slowly by interactive standards).

## What was not built this phase

Real queue-depth/rejected-request/retry Prometheus metrics beyond the query-route/claims-removed/refusal/confidence counters added (see below) — a dedicated request queue in front of the AI gateway does not exist in this codebase (requests are handled synchronously per NestJS request, rate-limited but not queued), so there is no real queue depth to expose. Embedding/response caching beyond the one real OEM-search cache was not built.

## New Prometheus metrics (real, live)

`aios_catalogue_query_route_total{routeType}`, `aios_catalogue_claims_removed_total`, `aios_catalogue_refusal_total{reason}`, `aios_catalogue_confidence_total{level}` — added to the existing `MetricsService` (Phase 5, unchanged mechanism) and wired directly from `CatalogueRagService`. Confirmed live via `curl http://127.0.0.1:3900/metrics`: the metric names are registered and scrapeable immediately after the backend hot-reloaded this code.

Real, honest scoping note found while verifying this: these four counters only increment for queries that go through `CatalogueRagService.ask()` — i.e. `POST /catalogue/rag/ask`. `POST /catalogue/search` (the deterministic-only endpoint) calls `CatalogueSearchService` methods directly from the controller and never routes through the query classifier, so it correctly does **not** increment `aios_catalogue_query_route_total` — confirmed by a real live call to `/catalogue/search` followed by a `/metrics` check showing no change. This is architecturally correct (that endpoint has no "route" to record — it always performs exact/keyword lookups), not a bug, but it does mean these metrics only cover generative-path traffic, not the full catalogue-ai request volume. Real route-classification log lines (`Query routed as IDENTIFIER`, `Query routed as DESCRIPTION`) were separately observed during this phase's real integration-test runs, confirming the counters do increment when `catalogueRag.ask()` is actually invoked.
