# Forecasting Services

`src/forecasting/` — real statistical forecasting over operational history (`SalesDocumentLine`, `PurchaseDocumentLine`, `GarageJob` — the same tables Phase 2's inventory analytics already reads, no parallel demand pipeline). No deep learning: the spec's own instruction — "Never assume deep learning is automatically better" — is followed literally by backtesting several classical methods against real held-out history and picking whichever one actually measures best for that specific series.

## Methods (`forecast-math.ts`, pure)

- `NAIVE` — repeats the last observed value.
- `MOVING_AVERAGE` — mean of the trailing 7 days.
- `EXPONENTIAL_SMOOTHING` — recency-weighted level (`alpha = 0.3`).
- `SEASONAL_NAIVE` — repeats the same weekday pattern from the last 7-day cycle.

## Backtest first, forecast second

`backtestAndCompare(series, testHoldoutDays)` fits every method on all but the last `testHoldoutDays` of real history, predicts over that held-out window, and scores each against what actually happened (`computeErrorMetrics`: MAPE, RMSE, MAE, bias). `pickBestMethod()` ranks by MAPE (falling back to RMSE when MAPE is undefined — an all-zero-actual holdout has no meaningful percentage error). Only the winning method's projected future points are persisted as `ForecastPoint` rows; **all four methods' evaluations are still persisted as their own `ForecastRun` rows**, so "automatically compare forecasting models" produces an inspectable audit trail — a reviewer can see exactly why one method beat the others, not just trust a single number.

## Confidence requires both history length and measured accuracy

`computeForecastConfidence(historyDays, mape)`: fewer than 14 days of history is always `INSUFFICIENT_DATA` regardless of how well a method happens to backtest on it — a method that scores well on 10 days hasn't actually been tested enough to trust the test itself. `HIGH` requires 60+ days of history *and* MAPE under 15%; `MEDIUM` requires 30+ days and under 30%; everything else is `LOW`.

## Real historical series per target type

`ForecastingService.getHistoricalSeries()` builds a dense, zero-filled daily series (`buildDailySeries()` — the same "sparse demand" principle as Phase 2's inventory analytics: an intermittent series' average must not be inflated by only averaging over the days it happened to have activity) from real rows:

| `targetType` | Source |
|---|---|
| `PART` / `LUBRICANT` | `SalesDocumentLine.quantity` grouped by `documentDate` |
| `GARAGE_WORKLOAD` | `GarageJob` count per day, filterable by `branchId` |
| `BRANCH` | `SalesDocumentLine` quantity for that branch's sales |
| `SUPPLIER` | `PurchaseDocumentLine.orderedQuantity` for that supplier |
| `CUSTOMER` | `SalesDocument` count per day for that customer |

A request with genuinely no activity anywhere in the lookback window (180 days) is rejected outright (`BadRequestException`) rather than silently forecasting zero forever — `buildDailySeries()` always returns a dense series even with zero source rows, so "no data" is checked as "every value in the series is zero," not "zero rows returned."

## Windows

7/30/60/90/180/365 days are all supported via the `windowDays` parameter to `POST /ai/forecast` — the forecast horizon is just how many future `ForecastPoint`s `generateForecast()` produces from the winning method, not a separate code path per window.

## Feeds into Intelligent Purchasing

See [ai-governance.md](ai-governance.md)'s reuse notes and `ai-purchasing-signals.service.ts`: the latest `chosenAsBest` `ForecastRun` for a part/lubricant is surfaced as supplementary evidence on that item's purchase recommendation, additive only — see the "Intelligent Purchasing" section below for why it never changes the recommendation's decision itself.

## Intelligent Purchasing enhancement

`AiPurchasingSignalsService` (`src/purchase-recommendations/ai-purchasing-signals.service.ts`) is a strictly additive, read-only overlay on Phase 2's `PurchaseRecommendationsService`. It reads three things another module already produced — the latest chosen-best `ForecastRun` for the item, a count of `RepeatRepairFlag`s on jobs that used this part, and a 90-day count of stock-check/out-of-stock/zero-result `AppEvent`s for it — and attaches them to the recommendation's `evidence` JSON as `aiSignals`. **`computePurchaseRecommendation()`, the fixed deterministic formula from Phase 2, is completely untouched** — `aiSignals` has no path back into the action/quantity decision. This is "explainable... AI never places purchase orders" applied structurally: the AI-touching code literally cannot influence the decision, it can only add cited context for a human reviewer.
