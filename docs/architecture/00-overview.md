# Automotive Intelligence Operating System (AIOS) — Architecture Overview

Working name: **AIOS** (Automotive Intelligence Operating System). Commercial name proposal: **Garagia** — kept generic here; all docs use AIOS.

## 1. What this is not

AIOS is not a POS, not an ERP, not a garage-management app, not a chatbot bolted onto a database. It is a layered platform where operational transactions, vehicle intelligence, and AI-driven decision support are separate, independently-scalable concerns that share one canonical data model. The existing sales/garage systems remain the transactional source of truth through Phase 1–2; AIOS earns the right to become the system of record module-by-module, never by a big-bang cutover.

## 2. The nine layers

```
1. Source systems            existing sales app/DB, existing ERP, job cards, DTC scanners, supplier feeds
2. Integration & sync        CDC / API ingestion / batch / log ingestion — never mutates source, never duplicates
3. Operational databases     PostgreSQL — vehicle, parts, lubricants, garage, purchasing, CRM (system of engagement)
4. Analytics warehouse       star schema, batch/CDC-fed from layer 3, read-only for BI + model training
5. AI / ML platform          DGX Spark — RAG, forecasting, matching, anomaly detection. Never transactional.
6. Business services         domain services (garage, parts, lubricants, purchasing, CRM) — the API surface layer 5 and 7 talk to
7. User applications         executive, garage, parts, lubricants, purchasing dashboards + role assistants
8. Security & governance     RBAC, branch/warehouse scoping, approval workflows, AI output states
9. Monitoring & audit        sync health, model drift, AI hallucination monitoring, full audit trail
```

Hard rule: **layer 5 (DGX) never becomes primary storage and never executes a financial or inventory-mutating transaction directly.** Every AI output lands as a *recommendation* in layer 3/6 and requires a human action (or an explicit, audited auto-apply policy scoped narrowly, e.g. "auto-send a service reminder") to become an executed transaction.

## 3. Phasing strategy (why Phase 1 is vehicle+parts+integration)

Every downstream capability — garage workflow, purchasing recommendations, forecasting, diagnostics — reads from the vehicle profile and parts master. Building purchasing or AI before the master data model and sync contracts are solid means building on sand: forecasts trained on un-deduplicated part records, or vehicle risk scores keyed to VINs that don't resolve consistently. See [04-roadmap.md](04-roadmap.md) for the full phase breakdown.

Because the real sales server, ERP, and DGX Spark are not reachable from this build environment, the integration layer is built to a **contract**, not to a live system: a documented adapter interface (see [02-integration-contracts.md](02-integration-contracts.md)) that Phase 1 implements with a file-based mock adapter, and that a later phase implements again with a real CDC/API adapter against the actual sales DB — without changing anything downstream.

## 4. Non-negotiables carried through every phase

- Every record synced from a source system carries: source system, source record ID, external ID, sync timestamp, record version, checksum, created/updated timestamps, sync status, error detail. No exceptions — this is what makes reconciliation and dedup possible later.
- No automatic merges of uncertain matches (parts, vehicles, customers) — matching proposes, a human approves.
- No AI-authored purchase order, diagnosis, or customer-facing technical claim executes without an explicit approval step and a citation trail.
- Every vehicle attribute correction preserves prior value + who/when/why (append-only history, never overwrite-in-place).
