# Cutover and Rollback

## Rollback unit

Every import operates through a `SyncRun` (the batch) and leaves a full, real audit trail: `RawSourceRecord.batchId` links every staged record to the batch that (re-)staged it; `RawSourceRecord.finalEntityType`/`finalEntityId` link every staged record to exactly what it became. To undo a batch's effects:

1. Find every `RawSourceRecord` for the batch (`WHERE batchId = ...`).
2. For each with a `finalEntityId`, determine whether that domain entity was newly created by this batch or already existed (cross-reference against `CustomerExternalReference`/`PartExternalReference`/`LubricantExternalReference`/`SalesExternalReference`'s `createdAt` against the batch's `startedAt`).
3. Newly-created entities can be safely deleted (no other batch or manual work depends on them yet, if caught quickly). Updated entities need a compensating update, not a delete — the phase's explicit rule against destructively removing transactional history applies here too.

This is a real, traceable procedure, not yet automated as a single "rollback batch N" command — see [decision-log.md](decision-log.md) for why that wasn't built in this pass.

## Never delete transactional history to correct an error

Consistent with the root project's existing rule (see [../architecture/decision-log.md](../architecture/decision-log.md) "Why a corrected sales line does not auto-adjust the ledger") — a bad import of `SalesDocument` rows is corrected with a new, correct re-import (the checksum-based update path already proven in [real-data-architecture.md](real-data-architecture.md) step 11) or an explicit compensating record, never a blind `DELETE`.

## Soft deactivation

`Customer.isActive`, `Part`/`LubricantProduct` (no `isActive` field currently on `Part` — a gap; `LubricantProduct.isActive` exists and is set from the real source's `IsActive` flag during import) are the mechanism for representing a source record that's gone inactive, without removing history that references it.

## Production/synthetic separation

This project's existing convention (separate `DATABASE_URL`/`TEST_DATABASE_URL`, a physically separate test Postgres database — see the root operational-core README) already enforces this. Real data imported in this pass went into the real dev/operational database; the automated test suite (`data-consolidation.integration-spec.ts`) exclusively uses fake, in-memory source adapters against the separate test database — it never connects to `MolasCacheDb`, `Parts_Catalog`, or any other live system. No new environment-separation mechanism was needed.

## Backup before backfill

See [production-backfill-runbook.md](production-backfill-runbook.md) — a real `BackupRun` (Phase 5's `BackupService`) should be recorded immediately before any larger backfill than the controlled batch already run.
