# Production Backfill Runbook

## What has actually been run against production data

As of 2026-07-12, one controlled batch has been run against both real, reachable sources (`MolasCacheDb`, `Parts_Catalog`) via `scripts/verify-real-data-consolidation.ts`:

1. Lubricants customers (full table, 4,247 rows)
2. Lubricants products (full table, 1,302 rows)
3. Lubricants sales orders (last 90 days, 1,640 rows)
4. Spare-parts item master (full `oitm` table, 9,154 rows)
5. Spare-parts sales orders / AutoHub (last 90 days, 1,758 rows)

This is real production data, imported into this application's real operational database (`aios_operational`) — not a test/synthetic run. Results are recorded in [real-data-architecture.md](real-data-architecture.md).

## Recommended phased order for further backfill (per the phase's own guidance — not all executed yet)

1. Organizations/branches/warehouses — already exist from Phase 2, no change needed.
2. Item groups — not yet imported from either real source.
3. Parts — done (spare parts, `oitm`).
4. Lubricants — done (`CacheProducts`).
5. Customers — done (lubricants side only; AutoHub has no customer master, see [parts-consolidation.md](parts-consolidation.md)).
6. Suppliers — not yet imported; no supplier-matching service exists yet (see [purchase-reconciliation.md](purchase-reconciliation.md)).
7. Price lists — partially present as flat fields on the imported master data (`PriceList_1`, `sell_price_tzs`); not modeled as a separate price-list entity yet.
8. Current stock snapshots — profiled, strategy documented, not executed (see [inventory-reconstruction.md](inventory-reconstruction.md)).
9. Recent sales — done (last 90 days, both sources).
10. Recent purchases — not done (see [purchase-reconciliation.md](purchase-reconciliation.md)).
11. Historical sales/purchases (beyond 90 days) — not done. `CacheInvoices` alone has real history back to 2024-02-04, `NeonAutoHubInvoices` back to 2023-11-08 — a real, multi-year backfill is possible but not yet run.
12. Inventory movements — not done (strategy documented, not executed).
13. Odoo quotations — not done, no real access confirmed.
14. Vehicle references / Digital Twin population — not done in this pass.

## Before running a larger backfill

1. **Confirm this is the intended production target** — `DATABASE_URL` in `.env` must point at the real operational database, not a test/scratch one. This pass ran against the real dev/operational database already used throughout this project's prior phases (see the root README) — for a genuinely separate production deployment, re-verify the connection string explicitly.
2. **Take a real backup first** — use Phase 5's `BackupService`/`POST /backup/full` (real `pg_dump`), not a manual copy. Record the `BackupRun` ID before starting.
3. **Run one bounded window at a time** — e.g. next 90-day slice, not "all history" in one call — matching the phase's explicit historical-backfill guidance.
4. **Reconcile after every window** — `ReconciliationReport` per batch; review manual-review-queue growth before continuing.
5. **Re-verify source row counts are unchanged** after each run (see the integrity check performed at the end of this pass's real run in [real-data-architecture.md](real-data-architecture.md)) — confirms the read-only guarantee held.

## Not yet built

Pause/resume/cancel-in-flight-batch controls, a scheduled/automatic incremental sync (this pass's adapters extract once per invocation, not on a timer), and a self-service "start backfill" API endpoint — these are the "admin commands" from the phase brief not yet exposed as unrestricted HTTP endpoints (see [decision-log.md](decision-log.md)). Backfill today is a supervised script invocation, which is appropriate given the scale and sensitivity of the real data involved.
