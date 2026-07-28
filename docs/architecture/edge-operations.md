# Phase 5 — Edge Operations

The operating model for branches/sites that may be offline or bandwidth-constrained — realized concretely by [branch-gateway.md](branch-gateway.md); this doc describes the model those mechanics serve.

## Offline-first principle

A branch site's local operations (job intake, part issue, inspection recording) must be able to continue when connectivity to headquarters is down, and reconcile once it returns — never block a technician's work on a live network link. Phase 5 builds the headquarters-side half of this (the queue, conflict detection, replay, health tracking in `branch-gateway.service.ts`); a genuine edge deployment additionally needs a branch-local persistence layer (out of scope this round — see [pwa.md](pwa.md)'s known limitations).

## Store-and-forward

`BranchOutboxMessage` rows are the store-and-forward unit — created, queued, retried up to `MAX_DELIVERY_ATTEMPTS = 5`, and replayable (`replay()`) if a delivery attempt fails. This is the same pattern used throughout the project for reliable one-directional delivery (compare to `IntegrationService`'s dead-letter handling from Phase 1).

## Conflict handling

`detectVersionConflict()`/`resolveConflict()` (`conflict-detection.ts`) — when a branch-local edit and a headquarters edit to the same resource diverge, the conflict is detected by version comparison and resolved by one of `HEADQUARTERS_WINS`/`BRANCH_WINS`/`MANUAL_REVIEW`. `MANUAL_REVIEW` is the safe default for anything not explicitly configured otherwise — an edge deployment shouldn't silently pick a winner on ambiguous data without an operator's own policy choice.

## Duplicate suppression

Same checksum/version-based dedup used everywhere in this system (see [decision-log.md](decision-log.md)) — a message replayed after a partial failure doesn't get double-applied, because the consumer, not the transport, is responsible for idempotency.

## Site health

`recordHealthPing()`/`getLatestHealth()` (`BranchHealthPing`) give headquarters visibility into which sites are currently reachable and how stale their last successful sync is — the concrete "site health" dashboard data source.

## Local event persistence

Not built at the branch/edge end in this round — `BranchOutboxMessage` is headquarters-side storage of messages *destined for* a branch (or received *from* one), not a local SQLite/IndexedDB store running at the branch site itself. See [pwa.md](pwa.md).

## Known limitations

- No branch-local agent/daemon exists to actually run offline and sync against this backend — this doc and [branch-gateway.md](branch-gateway.md) describe the headquarters-side infrastructure a branch client would sync through.
- Bandwidth-aware adaptive sync (beyond gzip compression) is not implemented.
