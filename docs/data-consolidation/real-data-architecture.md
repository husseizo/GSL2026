# Real Data Consolidation — Architecture

The Data Consolidation phase populates the existing platform (Phases 1–5, unchanged) with real operational data from live company systems, with full traceability, reconciliation, and quality control — a data-population and governance phase, not a feature phase.

## Real sources, as actually found (not as assumed)

The original brief expected three sources shaped a certain way. Real read-only profiling found a materially different picture — see [docs/data-sources/source-data-risks.md](../data-sources/source-data-risks.md) for the full list of surprises:

| Source | What it actually is | Role in this phase |
|---|---|---|
| `MolasCacheDb` (SQL Server) | A live, active SAP Business One ↔ Odoo middleware database for **lubricants** — not a passive cache. Real 2+ year commercial history. | Real source, adapter built: [molas-cache-db-profile.md](../data-sources/molas-cache-db-profile.md) |
| `MOLAS_Live_2021_Cache` (SQL Server) | Schema exists, mirrors `MolasCacheDb`, but is almost entirely empty. | Profiled, not ingested this pass: [molas-live-2021-cache-profile.md](../data-sources/molas-live-2021-cache-profile.md) |
| `Parts_Catalog` (Neon Postgres) | The real spare-parts source of truth: an existing "AutoHub" commercial application + a TecDoc vehicle-fitment catalog + VIN decode data — discovered during profiling, not named in the original brief. | Real source, adapter built: [parts-catalog-autohub-profile.md](../data-sources/parts-catalog-autohub-profile.md) |
| Odoo garage quotations | No confirmed reachable endpoint. | Deferred, honestly: [odoo-garage-profile.md](../data-sources/odoo-garage-profile.md) |

## Pipeline

```
Real source (SQL Server / Postgres, read-only)
  │  EnterpriseSourceAdapter.fetchChanges() — reused interface, see below
  ▼
StagingService.stageBatch() — RawSourceRecord (never a domain table directly)
  │  checksum-based dedup, same idempotent-replay guarantee as Phase 1
  ▼
ImportService.import*() — per-entity matching + upsert
  │  EXACT/HIGH_CONFIDENCE → update existing canonical entity
  │  NO_MATCH → create new canonical entity
  │  POSSIBLE_MATCH/CONFLICT → ManualReviewItem, never auto-merged
  ▼
Customer / Part / LubricantProduct / SalesDocument (existing Phase 1-2 domain tables)
  │
  ▼
ReconciliationService.reconcile() — counts + Decimal-accurate financial totals
```

## Deliberate reuse, not duplication

- `SourceAdapter`/`EnterpriseSourceAdapter` (Phase 1/5) — `MolasLubricantsCacheAdapter` and `PartsCatalogAutoHubAdapter` implement the same interface a REST-based adapter would, just backed by a direct SQL/Postgres connection instead of HTTP.
- `IntegrationSource`/`SyncRun` (Phase 1) — `IntegrationSource.name` is the unique feed identity (e.g. `MOLAS_CACHE_LUBRICANTS_CUSTOMERS`); `SyncRun` *is* the import batch. No new checkpoint/batch model was created — see [decision-log.md](decision-log.md).
- `SyncDeadLetter` (Phase 1), reused via `IntegrationService.recordDeadLetter()` — the exact same dead-letter store, not a parallel one.
- `CustomerExternalReference`/`SupplierExternalReference`/`LubricantExternalReference` (Phase 2) already gave those three entities multi-source canonical identity — `PartExternalReference`/`WarehouseExternalReference`/`BranchExternalReference` were added additively, mirroring the exact same shape, for the entities that didn't have one yet.
- `PartMatcherService` (Phase 1) — still the Part-to-Part duplicate detector; untouched. `PartConsolidationMatchingService` (new) answers a different question — "does this staged record match an existing Part" — before anything is created.

## What's genuinely new

`RawSourceRecord`, `SourceSchemaSnapshot`, `EntityMatchCandidate`, `ManualReviewItem`, `ReconciliationReport`, `SourceDeletionCandidate` — the staging, matching-confidence, review-queue, and reconciliation layer the brief required and that didn't already exist. See [staging-model.md](staging-model.md).

## Safety

Every adapter issues `SELECT` statements only. The SQL Server credential provided (`sa`) is a sysadmin account with full write access — the read-only guarantee is a code-discipline matter here, not a database-enforced one. See [source-data-risks.md](../data-sources/source-data-risks.md) §1 and [decision-log.md](decision-log.md).

## Real run results (2026-07-12, against live production data)

- 4,247 real lubricants customers staged and imported (3,992 new, 14 matched to existing records, 241 real ambiguous matches routed to manual review — never auto-merged).
- 1,640 real lubricants sales orders (last 90 days) imported; financial reconciliation matched exactly: source total 1,217,676,208.36 TZS = target total 1,217,676,208.36 TZS, computed with `Decimal`, not floating point.
- 9,154 real spare-parts item-master rows (`oitm`) processed; 7,723 new Parts created, 1,116 correctly consolidated into existing Parts via a shared real OEM number (e.g. two different item codes, `VAG10769`/`VAG13636`, both mapping to OEM `059903133R` — the same physical part re-catalogued).
- 1,758 real AutoHub spare-parts sales orders (last 90 days) imported.
- Idempotency proven: re-running the identical batch staged 0 new records.
- A simulated source correction (never written back to the live source) proved the update path in place.
- A simulated source-connection failure proved the checkpoint cursor is never advanced on a failed run.
- Source row counts independently re-verified unchanged after the run (4,247 / 9,154).

See [scripts/verify-real-data-consolidation.ts](../../services/operational-core/scripts/verify-real-data-consolidation.ts) for the exact, real, executable proof.
