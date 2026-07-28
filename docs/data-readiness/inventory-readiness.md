# Inventory Readiness

`src/data-readiness/inventory-readiness.service.ts` — a formal, queryable scoring of inventory-reconstruction readiness per business unit, building directly on the real schema findings already recorded in [docs/data-consolidation/inventory-reconstruction.md](../data-consolidation/inventory-reconstruction.md) (Data Consolidation phase) rather than re-guessing them.

## Real scores (2026-07-13)

| Business unit | Current balance | Historical movements | Purchase receipts | Sales issues | Transfers | Recommended strategy |
|---|---|---|---|---|---|---|
| LUBRICANTS | ✅ real (`CacheProducts.OnHandSap`/`AvailableCache`) | ❌ no ledger table | ❌ | ❌ (deliveries exist, not imported) | ⚠️ brand-specific only (`CacheLiquiMolyTransfers`, 7 rows) | **STRATEGY_B_OPENING_BALANCE** |
| SPARE_PARTS | ✅ real (`oitm.stock_on_hand`, `NeonAutoHubProducts.OnHandSap`) | ❌ no ledger table | ❌ (schema exists, 0/unknown real rows) | ❌ (deliveries exist, not imported) | ⚠️ real but transfer-only (`NeonAutoHubStockTransfers`, 2,398 rows) | **STRATEGY_B_OPENING_BALANCE** |

Neither business unit qualifies for **Strategy A** (full historical ledger reconstruction) — no source has a real movement-history table, only current snapshots and (for spare parts) a partial transfer history. Both are real candidates for **Strategy B** (an approved opening balance at a documented cut-off date, then future movements from incremental sync) — never forced to the same strategy by policy; they arrive at the same recommendation independently because they share the same real constraint.

## Gate: `isReadyForOpeningBalanceImport()`

Returns `true` only when **both** a verified warehouse mapping and an approved cut-off date are provided. As of 2026-07-13, neither business unit satisfies this: warehouse mapping for lubricants is `UNMAPPED` (see [branch-warehouse-mapping.md](branch-warehouse-mapping.md)), and no cut-off date has been approved for either. **No inventory backfill has been executed or approved this phase** — consistent with the phase's explicit rule and its own completion criteria ("inventory readiness is explicitly classified," not "inventory data is imported").

## What would unblock Strategy B

1. A human-confirmed warehouse-code mapping (see [branch-warehouse-mapping.md](branch-warehouse-mapping.md)).
2. An approved cut-off date (a business decision, not a technical one).
3. A real `InventoryAdjustment` (Phase 2's existing controlled create/approve pattern) recording the opening balance — never a raw ledger insert.
