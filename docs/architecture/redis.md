# Phase 5 — Distributed Services (Redis)

Redis as a **distributed cache and coordination layer**, never a system of record — every Phase 5 module that touches Redis can lose its Redis data with zero data loss, only a cold cache/reset coordination state.

## No system Redis on this box — real Redis via `redis-memory-server`

This Windows sandbox has no system-installed Redis. `redis-memory-server` (npm) downloads and runs a **genuine Redis binary** — not a JS mock, not an in-memory fake reimplementation. `scripts/start-dev-redis.js` starts it on port 16379 and prints `REDIS_URL=redis://127.0.0.1:16379`; it ran as a persistent background process for this entire session. In a real deployment, `REDIS_URL` points at an actual managed Redis instance — the client code is unchanged either way.

## `RedisService` (`src/redis/redis.service.ts`)

Wraps `ioredis`:

- `cacheGet`/`cacheSet`/`cacheDelete` — generic TTL'd cache.
- `acquireLock`/`releaseLock` — distributed locks; `releaseLock` uses a Lua script for atomic check-and-delete (only the lock holder can release it, no race between "check owner" and "delete").
- `isWithinRateLimit` — sorted-set sliding-window rate limiting, used by `api-rate-limit.guard.ts`.
- `pushToQueue`/`popFromQueue`/`queueLength` — simple list-backed queues, used for signal distribution and notification/AI temporary queueing.
- `ping()` — used by `/health/redis`.

## What Redis is used for in this build

Distributed cache, API rate limiting, distributed locks, and lightweight queue coordination. It is explicitly **not** used to store anything that must survive a Redis restart with no other copy — every durable fact (users, sessions' existence, refresh tokens, queue messages that must survive) lives in Postgres; Redis holds derived/ephemeral state only.

## Failure mode

`api-rate-limit.guard.ts` fails **open** if Redis is unreachable — an outage in a non-source-of-truth cache degrades to "no rate limiting" rather than blocking all API traffic.

## Tests

`redis.integration-spec.ts` (8 tests, all against the real `redis-memory-server` instance) — cache get/set/delete, lock acquire/release/contention, rate-limit window behavior, queue push/pop/length.

## Known limitations

- Single Redis instance, no Sentinel/Cluster — appropriate for this build's scale; the `ioredis` client would need connection-string changes (not code changes) to point at a clustered deployment.
- No pub/sub-based signal distribution built yet beyond the list-backed queue primitives — `pushToQueue`/`popFromQueue` are poll-based, not `SUBSCRIBE`-based.
