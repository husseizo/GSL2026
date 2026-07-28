# Phased Roadmap

Each phase produces something that runs end-to-end on real (or realistically mocked) data before the next phase starts. No phase depends on a later phase's output.

## Phase 1 — Foundation ✅ done
Vehicle master, parts master, integration/sync contract + mock adapter, dedup/matching queue, RBAC skeleton.
**Done when**: a batch of vehicle/part records can be synced idempotently from a file-drop source, duplicate OEM numbers surface as merge candidates, and vehicle attribute corrections are auditable. — Verified: `services/operational-core` Phase 1 test suite, 19 tests.

## Phase 2 — Commercial Data Foundation and Inventory Intelligence ✅ done
Organizations/branches/warehouses, customers, lubricants master, suppliers, sales/purchase document import (idempotent at document + line level, through the same integration engine as Phase 1), a movement-based inventory ledger with reservations/transfers/adjustments, app-event ingestion, deterministic lost-sales detection, inventory analytics (demand metrics, ABC/XYZ, movement classification), and three deterministic recommendation engines (purchase, transfer, supplier performance) — all rule-based, no ML, every recommendation requiring explicit human approval before anything executes.
**Done when**: real (sample) sales/purchase data flows through the sync contract idempotently including source corrections; inventory balances update correctly with negative-stock detection; lost-sale candidates deduplicate correctly; purchase/transfer recommendations generate with full evidence and are approved/rejected by a human; audit records exist for every reviewed decision. — Verified: `scripts/verify-phase2.ts` end-to-end run + 72 unit tests + 16 real-PostgreSQL integration tests. See [phase-2-commercial-foundation.md](phase-2-commercial-foundation.md).

Real integration against the actual legacy sales/ERP database (as opposed to the `FileDropAdapter` mock) still requires credentials/schema access not available in this environment — that swap remains the first task whenever real system access is granted, and requires no changes to anything downstream of the adapter (see [02-integration-contracts.md](02-integration-contracts.md)).

## Phase 3 — Garage Operations + Vehicle Service Intelligence (next)
Job-card lifecycle end to end (check-in → diagnosis → estimate → approval → parts reservation → work → QC → invoice → release), technician workflow, and — because the vehicle master, parts master, lubricants master, and inventory ledger already exist from Phases 1–2 — direct integration of VIN/mileage-aware lubricant recommendations and parts-consumption tracking into the job-card flow.
**Done when**: a job can go check-in → invoice with real parts reservation (using the existing `StockReservation` mechanism) and lubricant recommendation (using the existing `LubricantCompatibility`/`LubricantApproval` data), and garage-driven demand shows up correctly in the existing inventory analytics (`garageQty` on `InventoryItemMetric` already has a field for this, currently always zero pending real garage-issue movements).

## Phase 4 — Analytics warehouse + executive dashboards
Star schema populated from operational data (moving the JS-side aggregation in `InventoryAnalyticsService` into proper SQL/warehouse aggregation — see [phase-2-commercial-foundation.md](phase-2-commercial-foundation.md) §5–6's scale note), executive/garage/parts/lubricants/purchasing dashboards.
**Done when**: the dashboards in the spec (§18) are populated from real fact/dim tables, not stubs, at a data volume the current in-application aggregation wouldn't handle.

## Phase 5 — AI platform (DGX Spark)
RAG knowledge assistant, diagnostic assistant, embedding-based parts matching, demand forecasting, failure-pattern risk, purchase-recommendation scoring, anomaly detection — against the DGX Spark, once it's reachable and warehouse data has enough history to backtest against. The deterministic engines built in Phase 2 remain the fallback/baseline every AI-augmented version must beat, not something AI replaces wholesale.
**Done when**: forecast backtests meet an agreed service-level target and every AI output is flowing through the approval-state machine in [03-ai-platform.md](03-ai-platform.md).

## Explicit non-goals for now
- No big-bang replacement of the existing sales app at any phase — it remains source of truth until a module is proven and cut over deliberately, module by module.
- No deep-learning forecasting model before simpler models (moving average/ARIMA/gradient boosting) have a backtest baseline to beat.
- No automatic PO placement, no automatic part-master or lubricant-alternative merges, no automatic diagnosis, no automatic inventory-ledger correction, at any phase, without an explicit human-approval step.
