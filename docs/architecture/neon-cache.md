# Phase 5 — Neon Cloud Cache Database

A read-scaling/analytics-acceleration cache database, explicitly **never** the primary write path — PostgreSQL Operational Core remains the sole system of record, unchanged.

## No real Neon account in this environment

There is no live Neon account reachable from this sandbox. Rather than fabricate one, `NEON_DATABASE_URL` points at a second, genuinely separate local PostgreSQL database (`aios_neon_cache`, same portable Postgres instance, port 55432) as a real stand-in. Because Neon is Postgres-compatible under the hood, the exact same connection-string-based sync code works unchanged against a real Neon endpoint later — only `NEON_DATABASE_URL` changes.

## `NeonCacheSyncService` (`src/neon-cache/neon-cache-sync.service.ts`)

Uses a raw `pg.Client` rather than Prisma, deliberately — Prisma's single-datasource design in this codebase is bound to the Operational Core connection, and standing up a second Prisma client/schema for a cache database would be significant new surface for what's fundamentally a copy-out sync. `isConfigured()`/`isAvailable()` report honestly whether `NEON_DATABASE_URL` is set and reachable; `syncDataset()` pushes a named dataset's rows across; `getCachedDataset()` reads them back; `syncPurchaseRecommendations()` is the one concrete dataset wired up so far, feeding a read-scaled copy of Phase 2's purchase recommendations for dashboard/reporting use.

## Endpoints (`neon-cache.controller.ts`)

`POST /neon-cache/sync/:dataset`, `GET /neon-cache/:dataset`.

## Tests

`neon-cache-sync.integration-spec.ts` (4 tests) — real cross-database sync between the two genuinely separate local Postgres databases, not mocked.

## Known limitations

- No actual Neon account — see above. Structurally ready for one; not verified against one.
- Sync is pull-triggered (`POST /neon-cache/sync/:dataset`), not on a schedule or CDC-driven — a production deployment would likely trigger `syncDataset()` from a cron job or from the CDC pipeline ([cdc.md](cdc.md)) rather than an explicit API call.
- Only one dataset (purchase recommendations) has a concrete sync method; the generic `syncDataset()`/`getCachedDataset()` pair is designed to add more without new plumbing.
