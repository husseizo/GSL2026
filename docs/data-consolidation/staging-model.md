# Staging Model

Real data never lands directly in a domain table (`Customer`, `Part`, `LubricantProduct`, `SalesDocument`, ...) — everything is staged first. See `services/operational-core/src/data-consolidation/staging.service.ts`.

## `RawSourceRecord`

One row per `(feedName, sourceRecordKey)`. Re-extraction updates the same row; the raw checksum only changes if the content genuinely changed — the same idempotent-replay guarantee Vehicle/Part/Customer already use since Phase 1 (see [decision-log.md](decision-log.md) "Why source updates are checksum/version based" in the root decision log). Carries: source system/database/schema/table, the record's real business key, the full raw payload, a checksum, extraction/source timestamps, the batch (`SyncRun`) that (re-)staged it, and a processing/validation/normalization/matching status plus the final domain entity it resolved to (if any).

## What's reused, not duplicated

- **`IntegrationSource`/`SyncRun`** (Phase 1) — `IntegrationSource.name` is literally the unique feed identity (e.g. `MOLAS_CACHE_LUBRICANTS_CUSTOMERS`); this *is* the fix for the "cursor-collision bug" class of problem the brief warned about, because that name has been globally unique since Phase 1. `SyncRun` — with its `cursorBefore`/`cursorAfter`/per-run counts — *is* the import batch; there is no separate `ImportBatch` model. Two nullable columns (`extractionMode`, `schemaVersion`) were added additively to `IntegrationSource` to carry the extra metadata this phase's feeds need.
- **`SyncDeadLetter`** (Phase 1), via `IntegrationService.recordDeadLetter()` (already designed as a public, externally-callable entry point) — the same dead-letter store every other module uses.

## What's new

- **`SourceSchemaSnapshot`** — a combined schema + approximate-row-count capture, for drift detection. (The brief listed `SourceSnapshot` and `SourceSchemaSnapshot` as separate concepts; they were merged into one model here since, in practice, they're captured and compared together — see [decision-log.md](decision-log.md).)
- **`EntityMatchCandidate`** — generalizes `PartMatchCandidate`'s "propose, never auto-merge" pattern across every entity type this phase consolidates (Customer/Supplier/Part/Lubricant/Warehouse/Branch/Vehicle), rather than one parallel model per entity.
- **`ManualReviewItem`** — the single generic human-review queue (see [manual-review.md](manual-review.md)).
- **`ReconciliationReport`** — per-batch, per-entity-type counts and Decimal-accurate financial totals (see [sales-reconciliation.md](sales-reconciliation.md)).
- **`SourceDeletionCandidate`** — a source record present in one batch and absent from a later one, recorded rather than destructively deleted (not yet exercised by a real feed in this pass — every feed run so far has been additive/updating, not detecting removals; the model exists and is ready for the next feed that needs it).
- **`PartExternalReference`/`WarehouseExternalReference`/`BranchExternalReference`** — additive multi-source-reference tables mirroring `CustomerExternalReference`/`SupplierExternalReference`/`LubricantExternalReference`, which already existed.

## Pipeline order (implemented)

1. Extract (`EnterpriseSourceAdapter.fetchChanges()`)
2. Stage (`RawSourceRecord`, checksum dedup)
3. Normalize (per-source pure mapping functions — see `src/data-consolidation/normalizers/`)
4. Match (`CustomerMatchingService`/`LubricantMatchingService`/`PartConsolidationMatchingService`)
5. Resolve branch/warehouse — **not yet wired to real source codes** (see [decision-log.md](decision-log.md); `WarehouseExternalReference`/`BranchExternalReference` exist but have no populated mappings from real source warehouse codes like `01`/`COCWHSE`/`MainWHSE` yet)
6. Upsert (`ImportService`) — EXACT/HIGH_CONFIDENCE update, NO_MATCH create, POSSIBLE_MATCH/CONFLICT → manual review
7. Reconcile (`ReconciliationService`)

Commit cursor happens per extracted batch inside `StagingService.stageBatch()`, only after the batch's staging writes succeed — a failed batch never advances `IntegrationSource.lastCommittedCursor` (proven in `scripts/verify-real-data-consolidation.ts` step 12).
