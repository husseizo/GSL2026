# Phase 5 — Performance

Real measurements taken against the running application in this environment (portable PostgreSQL, `redis-memory-server`, CPU-only Ollama) — not projected/estimated numbers. Absolute latencies here reflect this sandbox's hardware and should be read as *relative* signal (what's expensive vs. cheap, and why) rather than a production SLA.

## API latency (10 real requests each, via `curl -w "%{time_total}"` against the live server on port 3900)

| Endpoint | Result |
|---|---|
| `GET /health` (composite: DB + Redis + DGX checks) | consistently ~417–469 ms |
| `GET /workshop-analytics/dashboard` (authenticated, real JWT) | mostly 6–15 ms, one 55 ms outlier |
| `GET /metrics` | 14.5 ms |

`/health`'s cost is dominated by its real DGX dependency check — a live HTTP round trip to the DGX service on every call, by design (a health endpoint that doesn't actually check its dependencies isn't a health endpoint). `/workshop-analytics/dashboard` is a plain authenticated read against Postgres and is correspondingly fast; the one 55 ms outlier is consistent with ordinary connection-pool/GC jitter, not a systemic issue.

## DGX inference latency

See [dgx-deployment.md](dgx-deployment.md) for the full benchmark table — headline numbers: sequential generation avg 2207.9 ms (CPU-only `llama3`), sequential embedding avg 545.8 ms, and a concurrent-embedding batch of 10 completing in 99 ms wall time vs. an estimated 5458 ms sequential-equivalent — Ollama's internal batching is genuinely efficient, a real finding worth keeping in mind for capacity planning.

## Branch Gateway / Notification throughput

Not separately load-tested this round; real functional-correctness timing comes from the integration test suites, which exercise real Postgres writes (and, for notifications, a real webhook HTTP call via `nock`) rather than mocks:

- `branch-gateway.integration-spec.ts` — 6 tests (enqueue/dequeue/replay/conflict-detection/health-ping), all passing against real Postgres.
- `notification.integration-spec.ts` — 7 tests (send/retry/preference/history), including a real webhook delivery, all passing.

These confirm correctness under real I/O; they are not a throughput benchmark (requests/sec under sustained concurrent load) — that would need a dedicated load-testing pass (k6/autocannon) against a non-shared environment, not attempted here to avoid disturbing the shared dev database during this build.

## Redis / cache hit ratio

Not separately measured — `redis.integration-spec.ts`'s 8 tests confirm cache get/set/delete, lock, rate-limit, and queue correctness against the real `redis-memory-server` instance, but no sustained-load hit-ratio measurement was run.

## Full test suite runtime

`npm run test:all` → 407/407 passing. (Individual suite timing is visible in Jest's own output; not separately compiled here since it reflects this sandbox's CPU contention with concurrently-running Redis/CDC-cluster/DGX/Ollama processes more than it reflects production characteristics.)

## Known limitations

- No dedicated load-testing tool (k6, autocannon, JMeter) was run — all latency numbers above come from small real request counts (10) or from integration test execution, sufficient to confirm real, working code and rough latency shape, not a load-tested SLA.
- No production-scale data volumes exist in this build's database — dashboard/query latencies at 10×–100× the current row counts have not been measured.
- Portal/dashboard load-time-in-a-real-browser was not measured (no browser automation tool available in this environment — see the Web Portal section of [integration-adapters.md](integration-adapters.md)'s sibling docs and the operational-core README for how portal verification was actually performed: real production build + real end-to-end API integration testing).
