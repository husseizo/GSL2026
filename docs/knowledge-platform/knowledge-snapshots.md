# Immutable Knowledge Snapshots

`KnowledgeSnapshot` is a new, separate model from `CatalogueIndexVersion` (never reused) — the same proven `BUILDING → VALIDATING → EVALUATING → APPROVED → ACTIVE → ROLLED_BACK/RETIRED` state machine shape as `CatalogueIndexVersionService`, scoped to the broader knowledge domain instead of just parts/lubricants. See `KnowledgeSnapshotService` (`src/knowledge-platform/snapshots/`).

## Build → validate → evaluate → approve → activate

`buildSnapshot()` snapshots every real, currently-`PUBLISHED` `KnowledgeItemVersion` into a `KnowledgeSnapshotItemVersion` join set and computes a checksum (`computeBenchmarkChecksum`, reused unmodified from DGX Prototype 1.6's registry). `validateSnapshot()` refuses an empty snapshot. `recordEvaluation()` attaches real metrics. `approve()` requires a real approver id.

## Activation — the blue-green flip

`activate(snapshotId)` throws unless the target is `APPROVED`. It demotes whichever snapshot is currently `ACTIVE` to `RETIRED` (de-approving that snapshot's materialized `KnowledgeDocument` rows) and promotes the target to `ACTIVE` (approving its own). Retrieval only ever serves the active snapshot's content — mirrors exactly how `CatalogueIndexVersionService.activate()` already works, but never touches a `CatalogueIndexVersion` row. Verified by the verify script (step 37, with a real checksum re-verification).

## Rollback

`rollback(badSnapshotId, reactivateSnapshotId)` marks the bad snapshot `ROLLED_BACK` and calls `activate(reactivateSnapshotId)` — an exact mirror of `CatalogueIndexVersionService.rollback()`'s existing semantics. **Real, load-bearing detail**: the reactivate target must still be `APPROVED` (never previously activated-then-retired) — `activate()`'s own guard requires it. Rolling back to a snapshot that was already retired is not supported by this method as written; a genuinely new snapshot would need to be built, approved, and activated instead. Verified by the verify script (step 38) using a scenario that matches this real constraint.
