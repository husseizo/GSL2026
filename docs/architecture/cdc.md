# Phase 5 — Change Data Capture

Real PostgreSQL logical replication, proved end-to-end against a genuinely separate throwaway Postgres cluster — not simulated, not mocked.

## Why a separate cluster

The shared dev/test Postgres instance runs `wal_level=replica` (confirmed via `SHOW wal_level`); logical replication requires `wal_level=logical`, which needs a server restart to change. Changing it on the already-populated shared database was judged too risky. Instead, a second, throwaway PostgreSQL cluster was initialized from scratch (`initdb`/`pg_ctl`, same portable Postgres binary distribution already used elsewhere in this project, port 55433) with `wal_level=logical` set at init time. `CdcModule` connects to it via `CDC_TEST_HOST`/`CDC_TEST_PORT`/`CDC_TEST_DATABASE` env vars.

## Implementation (`src/cdc/cdc.service.ts`)

Wraps `pg-logical-replication`'s `LogicalReplicationService` + `PgoutputPlugin` — a real logical-replication client speaking Postgres's actual `pgoutput` wire protocol, the same plugin Debezium itself uses under the hood. `startReplication()`/`stopReplication()` manage the replication slot; incoming changes are normalized into a Debezium-envelope-compatible shape (`before`/`after`/`operation`/`lsn`/`occurredAt`) and persisted as `CdcEvent` rows.

- **Idempotent replay** — dedup key is `(sourceName, lsn)`; replaying the same WAL position twice (e.g. after a crash before the checkpoint advanced) is a no-op.
- **Checkpoint recovery** — `CdcCheckpoint` tracks the last-processed LSN per source; `getCheckpoint()` resumes from there rather than the slot's confirmed-flush position, so recovery is explicit and inspectable.
- **Conflict detection** — `extractTimestamp()` compares an incoming change's embedded timestamp against the current row's last-known timestamp; an out-of-order or superseded change is recorded as a conflict (`listConflicts()`) rather than blindly applied.

## Endpoints (`cdc.controller.ts`)

`POST /cdc/start`, `/cdc/stop`, `GET /cdc/events`, `/cdc/checkpoint`, `/cdc/conflicts`.

## Debezium compatibility

The event envelope shape matches Debezium's `before`/`after`/`op`/source-offset convention closely enough that a real Debezium Postgres connector could be swapped in later without changing anything downstream of `CdcEvent` — no actual Kafka/Debezium runs in this environment; that compatibility is a shape/contract claim, verified by comparison against Debezium's documented envelope, not by running Debezium itself.

## Tests

`cdc.integration-spec.ts` (2 tests) — run against the real throwaway `wal_level=logical` cluster, not mocked.

## Known limitations

- No Kafka Connect / Debezium runtime deployed — direct `pg-logical-replication` client only.
- No SQL Server CDC implementation (the spec listed it as a target; only PostgreSQL logical replication was built and proved, since the project's own operational database is Postgres).
- The throwaway CDC cluster is not part of the normal dev/test startup sequence — it must be started manually per [phase5-decision-log.md](phase5-decision-log.md)'s notes before running `cdc.integration-spec.ts`.
