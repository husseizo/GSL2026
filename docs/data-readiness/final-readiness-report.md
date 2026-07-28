# Final Readiness Report — Data Validation, Business Baselining & AI Readiness

Real, executed results only (`scripts/verify-data-baseline-ai-readiness.ts`, run 2026-07-13 against this build's actual imported data and live source connections). No synthetic production evidence was used to produce any result below.

## What data is trustworthy

- **Spare-parts catalogue identity** (7,730 real Parts): high completeness (missing brand 2%, category 2.4%, description 0%), real OEM-based consolidation validated — 1,116 real merges, of which only 38 (4%) show a genuine category-level conflict worth reviewing; the other 592 brand-only differences are expected multi-supplier aftermarket coverage, not errors.
- **Lubricants product identity and commercial fields** (437 real products): unique codes, complete category/price data.
- **Lubricants sales-order financials** (1,640 real orders, 90-day window): reconciled to the cent — 1,217,676,208.36 TZS, `Decimal` arithmetic, zero variance, twice-verified reproducible.
- **Business baseline metrics**: 22 real metrics computed and approved in one reproducible run; re-running against the same data produces byte-identical checksums.

## What remains incomplete, and exactly why

| Gap | Why | What unblocks it |
|---|---|---|
| Customer identity completeness | 100% missing tax number, 96% missing email — real source limitation, not a pipeline defect | A source that actually carries this data (none confirmed) |
| Lubricant technical specifications | 99%+ missing viscosity/API/ACEA/approvals | Import `CacheLiquiMolyProducts` (profiled, not yet ingested) |
| Branch/warehouse mapping | Real source code (`MainWHSE`) has no exact match against existing `Warehouse` codes | A human confirming the real physical correspondence |
| Inventory opening balances | Neither business unit has verified warehouse mapping or an approved cut-off date | Both of the above, plus a human-approved cut-off date |
| Revenue/margin/payment-status metrics | Only `SALES_ORDER` imported; `INVOICE` (which drives these) is not | Import `CacheInvoices`/`NeonAutoHubInvoices` through the existing pipeline |
| Garage operational data | No real, reachable Odoo/garage-quotation source confirmed | Real Odoo API/export access |

## Which business metrics are now measurable

Customer (active/total/repeat-rate/inactivity-window counts), sales (total/count/average/median order value, cancelled/open rates), and data-pipeline (import success rate, manual-review rate, open dead-letter count) — all real, versioned, reproducible. Inventory and garage metrics are explicitly `NOT_READY`/`NOT_AVAILABLE` — reported honestly as part of the same catalogue, not silently omitted.

## Which AI use cases are ready

`READY_FOR_PROTOTYPE`: Automotive catalogue RAG, Parts semantic search, Lubricant product retrieval, Management assistant over reconciled sales data.
`READY_FOR_OFFLINE_EVALUATION`: Sales demand forecasting (real Croston/naive backtests already run against 45 real forecast-eligible/intermittent items).

## Which AI use cases are blocked, and on what specific evidence

`NEEDS_MORE_DATA`: Customer entity-resolution assistance (only 1 real reviewer decision recorded so far; needs 20+).
`NEEDS_LABELING`: OEM-number matching assistance (1,116 real positive examples, zero labeled negatives).
`BLOCKED_BY_SOURCE_ACCESS`: Lubricant specification assistant (no verified technical source), Vehicle failure prediction, Predictive maintenance, Technician diagnostic assistant, Garage workload forecasting — all four require real garage/DTC/repair-outcome/job-card data that does not exist in any confirmed source yet.

## What exact evidence is still required before advanced automotive intelligence can be introduced

1. Real, reachable Odoo (or equivalent) garage-operational data — job cards, DTCs, repair outcomes, parts/labour actually consumed.
2. A verified technical-specification source for lubricants (API/ACEA/OEM approvals).
3. A human-confirmed branch/warehouse code mapping.
4. An approved inventory cut-off date.
5. Import of `INVOICE`/`DELIVERY` document types (to unlock revenue/margin/payment-status metrics without violating double-count-prevention rules).
6. At least 19 more real, recorded customer-match reviewer decisions (to move entity-resolution assistance to offline evaluation).
7. Real labeled negative examples for OEM-number matching (rejected `POSSIBLE_MATCH` reviews are a natural real source once more review volume accumulates).

## Verification

`npx ts-node -T scripts/verify-data-baseline-ai-readiness.ts` — all 25 steps completed successfully against real data on 2026-07-13; reproducibility proven (identical checksums across two runs); source row counts confirmed unchanged; `npm run test:all` — **483/483 tests passing** (51 new tests this phase: unit tests for document-semantics, splits, leakage-checks, forecast-eligibility, data-quality-scoring, and forecast-math's new Croston/WAPE/MASE additions, plus 9 real-Postgres integration tests) after fixing two pre-existing Phase 4 tests that hardcoded the old 4-method forecast count (now 5, with Croston added) and one real bug caught by the verification script itself (a foreign-key violation from using a placeholder string instead of a real `User` id — see [decision-log.md](decision-log.md)).
