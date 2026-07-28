// Turns a raw calculated quantity into an operational one: never negative,
// respects minimum order quantity and package quantity, rounds UP so a
// recommendation never under-orders. The raw number is always preserved
// separately in the evidence object for audit — see
// docs/architecture/purchase-recommendation-engine.md §"No false precision".
export function roundToOperationalQuantity(
  rawQuantity: number,
  options: { minimumOrderQuantity?: number; packageQuantity?: number } = {},
): { finalQuantity: number; packageRoundingAdjustment: number } {
  const nonNegative = Math.max(0, rawQuantity);

  let quantity = Math.ceil(nonNegative);

  if (options.packageQuantity && options.packageQuantity > 1) {
    quantity = Math.ceil(quantity / options.packageQuantity) * options.packageQuantity;
  }

  if (options.minimumOrderQuantity && quantity > 0 && quantity < options.minimumOrderQuantity) {
    quantity = options.minimumOrderQuantity;
  }

  return { finalQuantity: quantity, packageRoundingAdjustment: quantity - Math.ceil(nonNegative) };
}
