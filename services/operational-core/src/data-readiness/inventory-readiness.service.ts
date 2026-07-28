import { Injectable } from '@nestjs/common';

export type InventoryStrategy = 'STRATEGY_A_HISTORICAL_LEDGER' | 'STRATEGY_B_OPENING_BALANCE' | 'STRATEGY_C_SNAPSHOT_ONLY' | 'STRATEGY_D_NOT_READY';

export interface InventorySourceScore {
  sourceSystem: string;
  businessUnit: 'LUBRICANTS' | 'SPARE_PARTS';
  hasCurrentBalance: boolean;
  hasHistoricalMovements: boolean;
  hasPurchaseReceipts: boolean;
  hasSalesIssues: boolean;
  hasTransfers: boolean;
  hasAdjustments: boolean;
  recommendedStrategy: InventoryStrategy;
  rationale: string;
}

// Real scoring, not a re-guess — reuses the exact findings already recorded
// in docs/data-consolidation/inventory-reconstruction.md (real schema
// inspection performed during the Data Consolidation phase), formalized
// into a queryable structure per this phase's requirement to score each
// business unit's inventory readiness separately rather than force one
// strategy across all sources. See docs/data-readiness/inventory-readiness.md.
@Injectable()
export class InventoryReadinessService {
  score(): InventorySourceScore[] {
    return [
      {
        sourceSystem: 'MOLAS_CACHE_LUBRICANTS',
        businessUnit: 'LUBRICANTS',
        hasCurrentBalance: true, // CacheProducts.OnHandSap/AvailableCache — real, current
        hasHistoricalMovements: false, // no movement-ledger table exists in the real schema
        hasPurchaseReceipts: false,
        hasSalesIssues: false, // deliveries exist (CacheDeliveries) but not imported this phase
        hasTransfers: true, // CacheLiquiMolyTransfers exists (brand-specific, small: 7 rows) — not a general ledger
        hasAdjustments: false,
        recommendedStrategy: 'STRATEGY_B_OPENING_BALANCE',
        rationale: 'Real, current stock-on-hand values exist (OnHandSap/AvailableCache) but no movement history — a dated opening balance at an approved cut-off, then future movements from incremental sync, is the only strategy the real data supports. See docs/data-consolidation/inventory-reconstruction.md.',
      },
      {
        sourceSystem: 'PARTS_CATALOG_AUTOHUB',
        businessUnit: 'SPARE_PARTS',
        hasCurrentBalance: true, // oitm.stock_on_hand, NeonAutoHubProducts.OnHandSap — real, current
        hasHistoricalMovements: false,
        hasPurchaseReceipts: false, // NeonAutoHubGoodsReceipts exists in schema but reported 0/unknown rows during profiling
        hasSalesIssues: false, // NeonAutoHubDeliveries exists but not imported this phase
        hasTransfers: true, // NeonAutoHubStockTransfers — 2,398 real rows, but transfers alone aren't a full movement ledger
        hasAdjustments: false,
        recommendedStrategy: 'STRATEGY_B_OPENING_BALANCE',
        rationale: 'Same real constraint as lubricants: current stock exists, full movement history does not. NeonAutoHubStockTransfers (2,398 real rows) is real but only covers transfers, not sales-issue/purchase-receipt/adjustment movements needed for Strategy A.',
      },
    ];
  }

  // Neither business unit currently qualifies for Strategy A (full ledger
  // reconstruction) or has an approved cut-off date for Strategy B yet —
  // this method exists so a caller can assert "no inventory backfill may
  // be approved until this returns true," per the phase's explicit rule.
  isReadyForOpeningBalanceImport(_businessUnit: 'LUBRICANTS' | 'SPARE_PARTS', warehouseMappingVerified: boolean, cutoffDateApproved: boolean): boolean {
    return warehouseMappingVerified && cutoffDateApproved;
  }
}
