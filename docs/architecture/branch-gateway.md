# Phase 5 — Branch Gateway & Edge Operations

The connectivity layer for branches that may have intermittent or low-bandwidth links to the operational core — offline-first by design. See [edge-operations.md](edge-operations.md) for the broader edge-site operating model this gateway serves.

## Components

- **Message signing** (`message-signing.ts`) — HMAC-SHA256 over each outbound message, keyed by `BRANCH_GATEWAY_SIGNING_KEY`, so a branch gateway can verify a message actually originated from headquarters (or vice versa) and wasn't tampered with in transit.
- **Compression** (`compression.ts`) — gzip/gunzip for payloads, reducing bandwidth over low-quality branch links.
- **Conflict detection** (`conflict-detection.ts`) — `detectVersionConflict()` compares a branch-local edit's base version against the current server version; `resolveConflict()` applies one of three strategies: `HEADQUARTERS_WINS`, `BRANCH_WINS`, `MANUAL_REVIEW` (the default for anything not explicitly configured to auto-resolve).
- **Queue** (`branch-gateway.service.ts`) — `enqueue()`/`dequeueNext()`/`processQueue()` against `BranchOutboxMessage`, `replay()` for reprocessing a failed message, `getQueueDepth()`, priority ordering. `MAX_DELIVERY_ATTEMPTS = 5` before a message is marked permanently failed rather than retried forever.
- **Connection health** — `recordHealthPing()`/`getLatestHealth()` against `BranchHealthPing`, so headquarters can see which branches are currently reachable and how stale their last successful sync was.

## Delivery guarantees

At-least-once, with idempotent consumers on the receiving side (the same checksum/version-based dedup pattern used everywhere else in this system — see [decision-log.md](decision-log.md)'s "Why source updates are checksum/version based"). A message can be delivered, retried, and replayed without double-applying, because the consumer dedups on message identity, not the gateway trusting exactly-once delivery.

## Scope enforcement

`branch-gateway.controller.ts` uses `@RequireBranchScope('branchId')` + `ScopeGuard` (see [authorization.md](authorization.md)) — a branch-scoped user can only see and act on their own branch's queue; org-wide roles see all branches.

## Endpoints

`POST /branch-gateway/:branchId/enqueue`, `GET /branch-gateway/:branchId/queue`, `POST /branch-gateway/:branchId/replay/:messageId`, `POST /branch-gateway/:branchId/health-ping`, `GET /branch-gateway/:branchId/health`.

## Tests

`message-signing.spec.ts`, `compression.spec.ts`, `conflict-detection.spec.ts` (all pure unit tests), `branch-gateway.integration-spec.ts` (6 tests, real Postgres — enqueue/dequeue/replay/conflict/health-ping).

## Known limitations

- No real branch-side client/daemon built — this is the headquarters-side gateway and queue; a branch site would run its own small sync agent against these endpoints, not built in this round.
- Bandwidth-aware sync (throttling by measured link quality) is not implemented beyond gzip compression — no adaptive chunking/backoff-by-bandwidth yet.
