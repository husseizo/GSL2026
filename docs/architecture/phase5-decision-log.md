# Phase 5 — Decision Log

Short entries — the reasoning behind choices that weren't the only reasonable option. Same format as [decision-log.md](decision-log.md)/[decision-log-phase3.md](decision-log-phase3.md).

## Why real auth was added as an overlay guard, not a rewrite of every controller
Every Phase 1–4 controller already calls `getRequestActor()` and trusts its return shape; rewriting each one to call a new auth service directly would touch dozens of files for no behavioral gain. Instead `JwtAuthContextGuard` runs globally (`APP_GUARD`) and attaches a `verifiedActor` to the request before any handler runs; `getRequestActor()` checks for it first and falls back to the legacy `x-user-role` header otherwise. Same return shape either way — zero changes needed to any existing `@UseGuards()` declaration. See [identity-platform.md](identity-platform.md).

## Why bcrypt for passwords but SHA-256 for refresh/reset/API-key tokens
A password is a low-entropy, human-chosen secret — it must be *slow* to hash so brute-forcing a stolen hash is expensive (`bcryptjs`). A refresh token, password-reset token, or API key is a high-entropy, randomly-generated secret — brute-forcing it is already infeasible regardless of hash speed, so a fast hash (SHA-256) is correct and avoids needlessly slow token-lookup queries. Using bcrypt everywhere would be slower for no security benefit on the token side; using SHA-256 for passwords would be a real vulnerability. See [identity-platform.md](identity-platform.md).

## Why JWT key rotation supports exactly two keys (current + previous), not an arbitrary list
Rotation needs to not invalidate tokens issued moments before the rotation — one previous key covers that window without unbounded key-list growth or a need to prune. If a longer grace period is needed later, the same `kid`-keyed lookup extends to more entries without a structural change.

## Why the CDC proof used a second throwaway Postgres cluster instead of altering the shared dev database
`wal_level=logical` requires a server restart to change, and the shared dev database was already populated with Phase 1–4 data other tests depend on. Restarting it to flip one setting was judged an unnecessary risk to already-passing work. A second cluster, initialized from scratch with `wal_level=logical` from the start, proves the same real `pg-logical-replication`/pgoutput mechanics with zero risk to the existing database. See [cdc.md](cdc.md).

## Why Neon cache uses a second local Postgres database, not a mock
No real Neon account is reachable from this environment. A mock client would prove nothing about real cross-database sync behavior (connection handling, transaction boundaries, actual row transfer). A second genuinely separate local Postgres database, connected via a raw `pg.Client`, proves the real mechanism end-to-end — and because Neon is Postgres-compatible, the same code points at a real Neon endpoint later with only a connection-string change. See [neon-cache.md](neon-cache.md).

## Why SAP B1/Odoo adapters were tested against `nock`, never a live instance
No live SAP Business One or Odoo instance is reachable from this environment. Fabricating a "successful sync against SAP" would be dishonest — instead, adapters were built against each system's real, documented API contract (SAP B1 Service Layer REST + B1SESSION cookie auth; Odoo JSON-RPC 2.0) and tested against `nock`-mocked servers replaying those exact contracts. This proves the adapter's request/response handling is correct against the real shape of each API; it does not prove the live systems behave identically to their own documentation. See [integration-adapters.md](integration-adapters.md).

## Why `redis-memory-server` was used instead of mocking Redis calls
Mocking `RedisService` would prove nothing about real Lua-script atomicity for lock release, real sorted-set sliding-window rate-limit behavior, or real connection handling. `redis-memory-server` downloads and runs an actual Redis binary, so every Phase 5 Redis test exercises the real thing — the only difference from a production Redis is where the binary came from. See [redis.md](redis.md).

## Why the idempotency interceptor was fixed from `tap` to `mergeMap`
`tap`'s callback return value is ignored by RxJS — an `async` function passed to `tap` becomes fire-and-forget, so the interceptor was marking a response as sent before its own "mark this idempotency key complete" database write had actually finished. A fast-following duplicate request could observe `completedAt` still `null` and be wrongly treated as "still in progress" (409) instead of receiving the now-available cached response. This was caught by a genuine failing integration test, not code review — `mergeMap` awaits the async callback before letting the observable emit downstream, closing the race. See [api-platform.md](api-platform.md).

## Why EMAIL/SMS/WHATSAPP/PUSH notifications use an honest console-log stand-in
No real mail server, SMS gateway, WhatsApp Business API credential, or push-notification credential exists in this environment. A provider interface (`NotificationProvider`) was built so each channel is a three-method implementation; `ConsoleLogProvider` is a clearly-labeled stand-in that logs the fully-rendered message rather than fabricating a delivery receipt. `InAppProvider` and `WebhookProvider` are the two channels that could be — and were — implemented for real, since "in-app" needs no external system and a webhook receiver could be stood up and tested with `nock`. See [notifications.md](notifications.md).

## Why audit-log immutability is enforced at the Postgres trigger level, not just in application code
An application-level "don't call `.update()`/`.delete()` on `AuditLog`" convention is not actually immutability — any future code path, migration script, or direct DB access could violate it. A `BEFORE UPDATE OR DELETE` trigger that raises an exception makes tampering structurally impossible at the database layer, independent of which code (or which person with `psql` access) attempts it. Verified by actually attempting a real `UPDATE`/`DELETE` in a test and confirming Postgres itself rejects it. See [security-production.md](security-production.md).

## Why the Web Management Portal was the one frontend built this round
Building all four frontends (Web Portal, Technician PWA, Customer Portal, Dealer Portal) as real, running applications is a multi-day effort on its own — each is a genuinely separate app. Asked to prioritize, the choice made was: harden the backend platform fully and for real, then build **one** real, working frontend end-to-end (login → JWT refresh → real dashboards against real data) rather than four shallow, partially-functional ones. The Web Portal was chosen as the representative case because it exercises the broadest slice of Phase 5's new backend surface (auth, MFA-gated login, user management, branch dashboards, system health) in one app. PWA/Customer/Dealer portals have real supporting APIs (see their respective docs) but no UI. See [pwa.md](pwa.md), [customer-portal.md](customer-portal.md), [dealer-portal.md](dealer-portal.md).

## Why DGX deployment manifests exist but were never actually run
No Docker daemon is available in this sandbox. Writing a `Dockerfile`/`docker-compose.yml` that's never been built is honestly less verified than everything else in this project — flagged explicitly as such in [dgx-deployment.md](dgx-deployment.md) rather than claimed as tested, in keeping with the spec's explicit instruction not to fabricate infrastructure that doesn't exist.
