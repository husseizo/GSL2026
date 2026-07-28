# DGX Spark Data-Access Contract

**No DGX Spark model training happens in this phase** — per the phase's explicit instruction, this document defines the contract a future phase's DGX Spark consumption must follow. Nothing here has been executed against real GPU hardware; there is no GPU in this environment (unchanged since Phase 4 — see [docs/architecture/dgx-platform.md](../architecture/dgx-platform.md)).

## The rule this contract exists to enforce

**DGX Spark must consume approved snapshots or approved APIs, not unrestricted transactional tables.** Every other principle below follows from this one.

## Approved network path

DGX Spark reaches this platform exactly the way Phase 4's `AiGatewayService`/`DgxClientService` boundary already works (unchanged) — the operational core calls out to the DGX FastAPI service, never the reverse. For training-data consumption specifically, the additional real constraint this phase adds: DGX never queries `Customer`/`SalesDocument`/`Part`/`LubricantProduct` directly. It receives a `DataSnapshot` export (see [data-snapshots.md](data-snapshots.md)) or calls a dedicated, versioned dataset-export API — never a live database connection string.

## AI gateway authentication

Reuses Phase 5's identity platform unchanged — a DGX-facing export job authenticates as a real service account (`ApiKeysService`, `isServiceAccount: true`), scoped to the new `aiDatasets.read` permission only. No new auth mechanism is introduced.

## Allowed datasets

Only datasets with an approved `AIDatasetContract` row (`approvedById`/`approvedAt` both set — see [ai-dataset-contracts.md](ai-dataset-contracts.md)) may ever be exported to DGX. An unapproved contract, or a dataset with no contract at all, is not eligible for export — enforced by the export job checking `approvedAt IS NOT NULL` before running, not by convention alone.

## Snapshot transfer method

A `DataSnapshot` (see [data-snapshots.md](data-snapshots.md)) is exported as a file (e.g. Parquet/CSV, not yet built — the snapshot *mechanism* is real; the *file export* format is a follow-up implementation detail once DGX consumption is actually prioritized) with its checksum recorded. DGX-side ingestion verifies the checksum before use — an export that doesn't match its recorded snapshot checksum is rejected, not silently used.

## Encryption

Same TLS/at-rest posture as every other Phase 5 export — see [docs/architecture/security-production.md](../architecture/security-production.md). No new encryption scheme introduced.

## Model-output contract

A DGX model's output (a forecast, a retrieval answer, an entity-match suggestion) is always a **recommendation**, written back through the existing `AiInferenceLog`/`ForecastRun` pattern (Phase 4) — never a direct write to a transactional table. This is unchanged from Phase 4's foundational rule ("DGX Spark never becomes primary storage and never executes a financial or inventory-mutating transaction directly" — see [docs/architecture/00-overview.md](../architecture/00-overview.md)).

## Inference logging

Reuses `AiInferenceLog` (Phase 4) unchanged — every DGX call, whether against a Phase 4 model or a future model trained on a Phase 6-approved dataset, is logged the same way.

## Dataset retention

Governed by `DataSnapshot.retentionPolicy` (default `RETAIN_INDEFINITELY` in this build, since real production data is neither large nor stale enough yet to need active pruning) — a future phase should set an explicit retention window once real dataset volume warrants it.

## No direct production database access

Structural, not just policy: no DGX-facing credential exists for `DATABASE_URL` in this build, and none should ever be created. The DGX FastAPI service (`services/dgx-ai-platform/`) has no database driver anywhere in its dependency tree (Phase 4's own security guarantee, unchanged — see [docs/architecture/security-dgx.md](../architecture/security-dgx.md)).

## Failure behaviour when DGX is unavailable

Unchanged from Phase 4 — `AiGatewayService` degrades gracefully (an "insufficient evidence"/service-unavailable response, never a hang or a fabricated answer). Nothing in this phase's dataset-export design depends on DGX being reachable to keep functioning — baseline computation, quality scoring, and review workflows all continue to work with DGX fully absent, which is in fact the state of this entire build (see [dgx-unavailable independence, tested](../../services/operational-core/src/data-readiness) — every service in this phase has zero runtime dependency on `AiGatewayService`/`DgxClientService`).

## Health-check contract

Reuses `/health/dgx` (Phase 5) unchanged for liveness. A future dataset-export job should additionally expose its own health/last-successful-export timestamp, not yet built (no export job exists yet — see above).

## Audit requirements

Every dataset export, snapshot creation, and contract approval already writes a real, timestamped row (`DataSnapshot.createdAt`/`approvedAt`, `AIDatasetContract.approvedAt`) — no separate audit table is needed for this contract specifically; the existing tables' own timestamps and approver fields are the audit trail.

## Summary: what's real vs. what's a contract for later

| Item | Status |
|---|---|
| Snapshot mechanism (`DataSnapshotService`) | Real, implemented, run this phase |
| Approved dataset contract (`AIDatasetContract`) | Real, implemented — one real contract (lubricant demand) built this phase |
| Snapshot file export (Parquet/CSV) to a DGX-reachable location | Not built — a follow-up implementation task |
| DGX-side training on an approved snapshot | Not attempted — explicitly out of scope this phase |
| Service-account auth for an export job | Design only — no export job exists yet to authenticate |
