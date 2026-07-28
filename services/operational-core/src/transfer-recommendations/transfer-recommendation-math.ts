// Pure, DB-free transfer-candidate evaluation. Using `available` (already
// onHand - reserved - quarantined - damaged, per
// src/inventory/balance-effects.ts) as the basis for both source-excess and
// destination-need calculations is what satisfies the spec's "item is not
// reserved / not damaged or quarantined" preconditions — those units are
// already excluded from `available` before this function ever sees them.
export interface TransferCandidateInputs {
  sourceAvailable: number;
  sourceSafetyStock: number;
  destAvailable: number;
  destReorderPoint: number;
  destTargetStock: number;
  destAvgDailyDemand: number;
  transferLeadTimeDays: number;
  supplierLeadTimeDays: number | null;
}

export interface TransferCandidateResult {
  suggestedQuantity: number;
  reason: string;
  sourceStockBefore: number;
  sourceStockAfter: number;
  sourceSafetyStockImpact: number; // how far above safety stock the source remains after transfer
  destStockBefore: number;
  destStockAfter: number;
  destDaysOfSupplyBefore: number | null;
  destDaysOfSupplyAfter: number | null;
}

export function evaluateTransferCandidate(inputs: TransferCandidateInputs): TransferCandidateResult | null {
  // Destination must actually have stock-out risk.
  if (inputs.destAvailable > inputs.destReorderPoint) return null;

  // Transfer must be faster than waiting on a supplier order, when a
  // supplier lead time is known. Unknown supplier lead time doesn't block a
  // transfer — an internal warehouse move is essentially always available
  // sooner than an unconfirmed external lead time.
  if (inputs.supplierLeadTimeDays !== null && inputs.transferLeadTimeDays >= inputs.supplierLeadTimeDays) {
    return null;
  }

  const sourceExcess = inputs.sourceAvailable - inputs.sourceSafetyStock;
  if (sourceExcess <= 0) return null; // source has no surplus above its own safety stock

  const destNeed = inputs.destTargetStock - inputs.destAvailable;
  if (destNeed <= 0) return null;

  const suggestedQuantity = Math.floor(Math.min(sourceExcess, destNeed));
  if (suggestedQuantity <= 0) return null;

  const destAvailableAfter = inputs.destAvailable + suggestedQuantity;
  const sourceAvailableAfter = inputs.sourceAvailable - suggestedQuantity;

  return {
    suggestedQuantity,
    reason: `Destination has ${inputs.destAvailable} units (below reorder point ${round2(inputs.destReorderPoint)}); source has ${round2(sourceExcess)} units of surplus above its safety stock of ${inputs.sourceSafetyStock}`,
    sourceStockBefore: inputs.sourceAvailable,
    sourceStockAfter: sourceAvailableAfter,
    sourceSafetyStockImpact: sourceAvailableAfter - inputs.sourceSafetyStock,
    destStockBefore: inputs.destAvailable,
    destStockAfter: destAvailableAfter,
    destDaysOfSupplyBefore: inputs.destAvgDailyDemand > 0 ? inputs.destAvailable / inputs.destAvgDailyDemand : null,
    destDaysOfSupplyAfter: inputs.destAvgDailyDemand > 0 ? destAvailableAfter / inputs.destAvgDailyDemand : null,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
