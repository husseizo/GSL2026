# Purchase-Recommendation Engine

`src/purchase-recommendations/purchase-recommendation-math.ts` (pure, unit-tested — 16 tests) implements the formulas exactly as specified; `purchase-recommendations.service.ts` orchestrates the DB reads and calls it. Nothing here ever creates a real purchase order — every result is a `PurchaseRecommendation` row in `PENDING` status until a human calls `approve()`/`reject()`.

## The three fixed formulas

```
reorderPoint      = avgDailyDemand × effectiveLeadTimeDays + safetyStock
targetStock       = avgDailyDemand × targetCoverageDays + safetyStock
suggestedQuantity = targetStock + confirmedDemand - availableStock - incomingStock - inTransitStock
```

`effectiveLeadTimeDays` is the supplier's nominal lead time, with a deterministic buffer (+20%) applied when demand is highly variable (coefficient of variation > 1) — not a statistical lead-time model, just an explicit, auditable adjustment.

## No false precision

The raw, unrounded `suggestedQuantityBeforeRounding` is always preserved in the `evidence` JSON for audit, but the number actually recommended is rounded via `src/common/rounding.ts`: ceil to a whole unit, then up to the nearest multiple of `packageQuantity`, then up to `minimumOrderQuantity` if still below it, capped at `maxCoverageDays` worth of demand. "11.73 units" never reaches a human; "12 units, raw calculation 11.73 in evidence" does.

## Action decision tree (`decideAction`, in priority order)

1. **`REVIEW_DATA`** — insufficient history (`hasSufficientHistory` false). Confidence is always `INSUFFICIENT_DATA`; no reorder/target math is even computed.
2. **Dead stock** (`movementClass === DEAD_STOCK`) — `DO_NOT_BUY` unless a `confirmedDemand > 0` exists, in which case `PURCHASE_ON_CONFIRMED_ORDER` (there's real demand despite the item being otherwise dead).
3. **Rare/highly intermittent** (coefficient of variation > 1.5, ≤ 1 sale in the last 90 days) **and** available stock doesn't already cover target coverage — `PURCHASE_ON_CONFIRMED_ORDER`. The "already covered" guard exists because an earlier version of this rule fired even when stock was already ample, producing a confusing `PURCHASE_ON_CONFIRMED_ORDER` at a suggested quantity of zero; caught by the Phase 2 verification run and fixed (see the regression test "does not classify a rare item as PURCHASE_ON_CONFIRMED_ORDER when existing stock already covers target coverage").
4. **Meaningful excess** (available > 1.5 × target stock, no confirmed demand, nothing incoming) — `CLEAR_EXISTING_STOCK`.
5. **At or below reorder point** with a positive suggested quantity — `BUY_NOW` if criticality is `CRITICAL`, stock-out risk is `HIGH`, or there's evidence of lost sales; otherwise `BUY_SOON`.
6. Otherwise — `MONITOR`.

Whenever the verdict is anything other than `BUY_NOW`/`BUY_SOON`/`PURCHASE_ON_CONFIRMED_ORDER`, the returned `suggestedQuantity` is forced to `0` — the action and the quantity can never contradict each other (e.g. "DO_NOT_BUY, qty 12").

## Confidence

`HIGH` only for `FAST_MOVING`/`MEDIUM_MOVING` items with a known supplier lead time, known demand variability, and no warnings raised during calculation. Anything with a fallback default (unknown lead time → `DEFAULT_LEAD_TIME_DAYS = 30`) or a warning drops to `MEDIUM`. Insufficient history is always `INSUFFICIENT_DATA`.

## Evidence object

Every recommendation's `evidence` JSON contains: available/reserved/incoming stock, avg daily demand, reorder point, safety stock, effective lead time, confirmed demand, lost-sales quantity, target stock, raw and final suggested quantity, the package-rounding adjustment, confidence, and any warnings — everything needed to reconstruct *why*, matching the spec's worked example format exactly.

## Where the inputs come from

`safetyStock`, `minimumOrderQuantity`, `packageQuantity`, `targetCoverageDays`, `maxCoverageDays`, `criticality`, and the default supplier live on `ItemPlanningProfile` (one row per item, keyed by the same non-null `itemKey` surrogate used throughout the inventory ledger — see [inventory-ledger.md](inventory-ledger.md)) rather than on `Part`/`LubricantProduct` directly: these are operational tuning knobs, not catalog attributes. An item with no profile falls back to `safetyStock=0`, `targetCoverageDays=30`, `maxCoverageDays=90`, no MOQ/package rounding, and the default lead time.

`confirmedDemand` is the sum of open (`OPEN`/`PARTIALLY_FULFILLED`) `SALES_ORDER` line quantities for that item and warehouse — real customer commitments, not a forecast.
