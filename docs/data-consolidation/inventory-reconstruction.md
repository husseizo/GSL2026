# Inventory Reconstruction

**No strategy has been executed in this pass.** The phase brief explicitly requires choosing and documenting one of three strategies per source based on real data quality — that choice is made here, but implementation is deferred to a follow-up pass, since committing real opening-balance/ledger data warrants its own dedicated review and approval step (see [production-backfill-runbook.md](production-backfill-runbook.md)).

## The three strategies, and which real data supports which

**Strategy A — Historical ledger reconstruction.** Would require complete, gapless historical inventory-movement records from the source. Neither real source has this: `MolasCacheDb` has no dedicated inventory-movement table at all (only current `OnHandSap`/`AvailableCache` snapshot columns on `CacheProducts`); `Parts_Catalog`/AutoHub likewise has no movement ledger, only `NeonAutoHubStockTransfers` (2,398 real transfer records, not a full movement history) and current stock fields on `oitm`/`NeonAutoHubProducts`. **Not supportable from either real source as profiled.**

**Strategy B — Opening balance plus future movements.** Requires a documented cut-off date, then only movements after that date are imported. This is the strategy the real data supports: both sources have current, real stock-on-hand values (`CacheProducts.OnHandSap`/`AvailableCache`, `oitm.stock_on_hand`, `NeonAutoHubProducts.OnHandSap`) that could become a real `InventoryBalance`/opening-movement snapshot as of a chosen cut-off date, with `IntegrationSource`'s cursor-based incremental extraction (already built) picking up from there for anything the sources start reporting after that date.

**Strategy C — Snapshot reconciliation.** Reporting-only stock snapshots, kept separate from the operational ledger. Also supportable, and lower-risk than B, but doesn't give the operational inventory ledger (Phase 2's `InventoryLedgerService.postMovement`) real starting balances to work from.

## Recommendation (not yet executed)

Strategy B, using each source's current stock snapshot as a real, dated opening balance, imported via a new, explicit `InventoryAdjustment` (Phase 2's existing controlled two-step create/approve pattern — see the root [decision-log.md](../architecture/decision-log.md) "Why approval is separated from execution") rather than a raw ledger insert. This preserves the existing inventory ledger's integrity guarantees (every balance traces to a real, approved movement) while giving the operational system real, current stock figures to start from.

## Why this wasn't executed in this pass

Committing an opening balance is a one-way door for the operational inventory ledger — an incorrect cut-off snapshot is expensive to unwind (see [cutover-and-rollback.md](cutover-and-rollback.md)). The phase's own completion criteria list "inventory strategy is documented and verified" as a distinct bar from "opening balances imported" — this document satisfies the former. Executing the latter needs an explicit, human-approved cut-off date and warehouse-code mapping (see [decision-log.md](decision-log.md) "Why branch/warehouse resolution is deferred") that hasn't been provided yet.
