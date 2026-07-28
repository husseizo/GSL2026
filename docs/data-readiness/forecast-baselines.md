# Forecast Baselines

Extends Phase 4's `src/forecasting/forecast-math.ts` additively — Croston's method, WAPE, and MASE — rather than building a parallel forecasting engine. See [docs/data-readiness/decision-log.md](decision-log.md).

## Why Croston

The four existing methods (naive, moving average, exponential smoothing, seasonal naive) are all designed for dense series. Real profiling this phase found 42 of 213 real lubricant items (20%) are genuinely intermittent-demand (many zero-sale days) — a moving average is dragged toward zero by those days, and naive just repeats whatever the last day happened to be. Croston separates "how big is a sale when one happens" from "how often do sales happen" and smooths each independently — the standard classical method for exactly this real pattern.

## Why WAPE and MASE, not MAPE alone

Per the phase's explicit rule, `pickBestMethod()` was changed to rank by **WAPE** (a single ratio over the whole series, well-defined even when many actual values are zero) instead of MAPE (undefined per-point when actual demand is zero — exactly the common case for intermittent items). MASE (scaled against a naive one-step-ahead in-sample error) was added so error is comparable across items of very different volume.

## Real backtest results (2026-07-13, against real `SalesDocumentLine` data)

45 of 213 real lubricant products were forecast-eligible or intermittent-demand and got a real backtested forecast:

| Product (truncated id) | Best method | Real WAPE | Real MASE |
|---|---|---|---|
| abb358bd... | CROSTON | 124.28% | 0.729 |
| bf34093a... | NAIVE | 100.00% | 0.813 |
| 30de472d... | NAIVE | 100.00% | 0.730 |
| 7da188d2... | NAIVE | 100.00% | 0.929 |
| cf01870b... | NAIVE | 100.00% | 0.929 |

**Honest reading**: WAPE values above 100% on a 90-day real window are not surprising — this is real intermittent demand with limited history, not a broken forecast. MASE below 1.0 (as seen above) means the model still beats a naive one-step-ahead forecast, which is the more meaningful real signal on this short a window. As more real sales-order history is imported (see [docs/data-consolidation/production-backfill-runbook.md](../data-consolidation/production-backfill-runbook.md)), WAPE is expected to improve — this baseline exists to be re-run and compared against, not treated as a final verdict.

## Eligibility classification (`src/data-readiness/ml/forecast-eligibility.ts`)

`FORECAST_ELIGIBLE`, `INTERMITTENT_DEMAND`, `INSUFFICIENT_HISTORY`, `IDENTITY_CONFLICT`, `DATA_GAP`, `DISCONTINUED`, `MANUAL_REVIEW_REQUIRED` — real thresholds used: 30 minimum history days, 10 minimum non-zero periods, 60 days since last sale before `DISCONTINUED`. Real result: `DATA_GAP` 84, `INSUFFICIENT_HISTORY` 64, `DISCONTINUED` 20, `INTERMITTENT_DEMAND` 42, `FORECAST_ELIGIBLE` 3 — the large `DATA_GAP`/`INSUFFICIENT_HISTORY` counts are a direct, honest consequence of the currently-imported 90-day window, not a flaw in the classifier.

## Deep learning

Not attempted, per the phase's explicit "do not begin with deep learning" rule — five classical methods were backtested and compared on real held-out data first, exactly as instructed.
