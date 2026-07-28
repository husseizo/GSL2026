// Pure statistical forecasting — no DB, no LLM, no deep learning. The spec
// is explicit: "Never assume deep learning is automatically better" —
// several classical methods are backtested against real held-out history
// and compared on measured error, and the best-performing one for THIS
// series is what gets used, not whichever method sounds most sophisticated.
// See docs/architecture/forecasting.md.
export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Dense daily series with explicit zero-fill for days with no activity —
// same principle as Phase 2's inventory-analytics "sparse demand" handling:
// an intermittent-demand item's average must not be inflated by only
// averaging over the days it happened to sell.
export function buildDailySeries(events: { date: Date; quantity: number }[], startDate: Date, endDate: Date): TimeSeriesPoint[] {
  const byDay = new Map<string, number>();
  for (const event of events) {
    const key = toDayKey(event.date);
    byDay.set(key, (byDay.get(key) ?? 0) + event.quantity);
  }

  const series: TimeSeriesPoint[] = [];
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += DAY_MS) {
    const date = new Date(t);
    series.push({ date, value: byDay.get(toDayKey(date)) ?? 0 });
  }
  return series;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function naiveForecast(series: TimeSeriesPoint[], horizonDays: number): number[] {
  const last = series[series.length - 1]?.value ?? 0;
  return Array(horizonDays).fill(last);
}

export function movingAverageForecast(series: TimeSeriesPoint[], horizonDays: number, windowDays = 7): number[] {
  const window = series.slice(-windowDays);
  const avg = window.length > 0 ? window.reduce((sum, p) => sum + p.value, 0) / window.length : 0;
  return Array(horizonDays).fill(avg);
}

export function exponentialSmoothingForecast(series: TimeSeriesPoint[], horizonDays: number, alpha = 0.3): number[] {
  if (series.length === 0) return Array(horizonDays).fill(0);
  let level = series[0].value;
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i].value + (1 - alpha) * level;
  }
  return Array(horizonDays).fill(level);
}

export function seasonalNaiveForecast(series: TimeSeriesPoint[], horizonDays: number, seasonLength = 7): number[] {
  if (series.length === 0) return Array(horizonDays).fill(0);
  const result: number[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const idx = series.length - seasonLength + (i % seasonLength);
    result.push(series[idx >= 0 ? idx : series.length - 1]?.value ?? series[series.length - 1].value);
  }
  return result;
}

// Croston's method (Data Validation & Business Baselining phase addition)
// — designed specifically for intermittent demand (many zero-demand
// periods), where the four methods above systematically mis-forecast: a
// moving average is dragged toward zero by the zero-days, and a naive
// forecast just repeats whatever the last day happened to be (0 or a
// spike). Croston separates "how big is a sale when one happens" from
// "how often do sales happen" and smooths each independently. See
// docs/data-readiness/forecast-baselines.md.
export function crostonForecast(series: TimeSeriesPoint[], horizonDays: number, alpha = 0.1): number[] {
  const nonZero = series.filter((p) => p.value !== 0);
  if (nonZero.length === 0) return Array(horizonDays).fill(0);

  let demandEstimate = nonZero[0].value;
  let intervalEstimate = 1;
  let sinceLastDemand = 0;

  for (const point of series) {
    sinceLastDemand += 1;
    if (point.value !== 0) {
      demandEstimate = alpha * point.value + (1 - alpha) * demandEstimate;
      intervalEstimate = alpha * sinceLastDemand + (1 - alpha) * intervalEstimate;
      sinceLastDemand = 0;
    }
  }

  const ratePerDay = intervalEstimate > 0 ? demandEstimate / intervalEstimate : 0;
  return Array(horizonDays).fill(ratePerDay);
}

export type ForecastMethodName = 'NAIVE' | 'MOVING_AVERAGE' | 'EXPONENTIAL_SMOOTHING' | 'SEASONAL_NAIVE' | 'CROSTON';

const METHODS: { name: ForecastMethodName; predict: (series: TimeSeriesPoint[], horizonDays: number) => number[] }[] = [
  { name: 'NAIVE', predict: naiveForecast },
  { name: 'MOVING_AVERAGE', predict: (s, h) => movingAverageForecast(s, h, 7) },
  { name: 'EXPONENTIAL_SMOOTHING', predict: (s, h) => exponentialSmoothingForecast(s, h, 0.3) },
  { name: 'SEASONAL_NAIVE', predict: (s, h) => seasonalNaiveForecast(s, h, 7) },
  { name: 'CROSTON', predict: (s, h) => crostonForecast(s, h, 0.1) },
];

// A series counts as "intermittent demand" when a large share of periods
// have zero activity — Croston is specifically for these; the other four
// methods are better suited to dense/regular series. See
// classifyForecastEligibility() below for how this feeds the phase's
// eligibility classification.
export function isIntermittentDemand(series: TimeSeriesPoint[], zeroShareThreshold = 0.3): boolean {
  if (series.length === 0) return false;
  const zeroCount = series.filter((p) => p.value === 0).length;
  return zeroCount / series.length >= zeroShareThreshold;
}

export interface ErrorMetrics {
  mape: number;
  rmse: number;
  mae: number;
  bias: number;
  // Data Validation & Business Baselining phase additions. The spec is
  // explicit: "MAPE must not be used alone, especially for zero or
  // intermittent demand" — WAPE (weighted absolute percentage error, a
  // single ratio over the whole series rather than an average of
  // per-point ratios) stays well-defined even when many individual actual
  // values are zero; MASE (mean absolute scaled error, scaled against a
  // naive one-step-ahead forecast) is comparable across series with very
  // different volume/scale, which raw MAE/RMSE are not.
  wape: number;
  mase: number;
  // DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2):
  // the real, already-computed sum of absolute actual values over the
  // held-out test window — the exact, persisted evidence a later
  // certification gate needs to verify "zero real business activity"
  // (Amendment v1.1 §6A condition 2/3) without ever recomputing business
  // data at certification time. Purely additive — does not change how
  // mape/rmse/mae/bias/wape/mase are computed.
  testActualSum: number;
}

// MAPE skips days with zero actual demand (division by zero is undefined,
// not zero) — RMSE/MAE/bias/WAPE use every point regardless, so a series
// with many zero-demand days still gets a meaningful absolute-error
// comparison even when MAPE itself is NaN.
export function computeErrorMetrics(actual: number[], predicted: number[]): ErrorMetrics {
  const n = Math.min(actual.length, predicted.length);
  let sumSqErr = 0;
  let sumAbsErr = 0;
  let sumErr = 0;
  let sumAbsPct = 0;
  let countForMape = 0;
  let sumAbsActual = 0;

  for (let i = 0; i < n; i++) {
    const error = predicted[i] - actual[i];
    sumSqErr += error * error;
    sumAbsErr += Math.abs(error);
    sumErr += error;
    sumAbsActual += Math.abs(actual[i]);
    if (actual[i] !== 0) {
      sumAbsPct += Math.abs(error / actual[i]);
      countForMape += 1;
    }
  }

  // Naive one-step-ahead in-sample error (|actual[i] - actual[i-1]|) is the
  // scaling denominator for MASE — undefined (not zero) for a series with
  // fewer than 2 points or where every consecutive difference is zero.
  let sumNaiveAbsErr = 0;
  let naiveCount = 0;
  for (let i = 1; i < n; i++) {
    sumNaiveAbsErr += Math.abs(actual[i] - actual[i - 1]);
    naiveCount += 1;
  }
  const naiveMae = naiveCount > 0 ? sumNaiveAbsErr / naiveCount : 0;

  return {
    mape: countForMape > 0 ? (sumAbsPct / countForMape) * 100 : NaN,
    rmse: n > 0 ? Math.sqrt(sumSqErr / n) : NaN,
    mae: n > 0 ? sumAbsErr / n : NaN,
    bias: n > 0 ? sumErr / n : NaN,
    wape: sumAbsActual > 0 ? (sumAbsErr / sumAbsActual) * 100 : NaN,
    mase: naiveMae > 0 ? (n > 0 ? sumAbsErr / n : NaN) / naiveMae : NaN,
    testActualSum: sumAbsActual,
  };
}

export interface MethodEvaluation extends ErrorMetrics {
  method: ForecastMethodName;
}

// Backtest: fit each method on everything except the last `testHoldoutDays`,
// predict over that held-out window, and score against what actually
// happened. Returns one evaluation per method — nothing is assumed best
// without measuring it against real held-out data first.
export function backtestAndCompare(series: TimeSeriesPoint[], testHoldoutDays: number): MethodEvaluation[] {
  if (series.length <= testHoldoutDays || testHoldoutDays <= 0) return [];

  const train = series.slice(0, series.length - testHoldoutDays);
  const test = series.slice(series.length - testHoldoutDays);
  const actual = test.map((p) => p.value);

  return METHODS.map(({ name, predict }) => {
    const predicted = predict(train, testHoldoutDays);
    return { method: name, ...computeErrorMetrics(actual, predicted) };
  });
}

// Ranks by WAPE, not MAPE — the phase's explicit rule ("MAPE must not be
// used alone, especially for zero or intermittent demand") means the
// primary ranking metric itself has to be one that stays meaningful on a
// zero-heavy series, which MAPE (undefined per-point when actual=0) is
// not and WAPE (a single ratio over the whole series) is. RMSE is the
// fallback only when WAPE itself is undefined (an all-zero actual series).
export function pickBestMethod(evaluations: MethodEvaluation[]): MethodEvaluation | null {
  const ranked = evaluations
    .filter((e) => Number.isFinite(e.rmse))
    .sort((a, b) => {
      const aScore = Number.isFinite(a.wape) ? a.wape : a.rmse;
      const bScore = Number.isFinite(b.wape) ? b.wape : b.rmse;
      return aScore - bScore;
    });
  return ranked[0] ?? null;
}

export type ForecastConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

// History length AND measured accuracy both gate confidence — a method that
// backtests well on 10 days of history still isn't a HIGH-confidence
// forecast; there simply isn't enough history to trust the backtest itself.
export function computeForecastConfidence(historyDays: number, mape: number | undefined): ForecastConfidence {
  if (historyDays < 14) return 'INSUFFICIENT_DATA';
  if (mape === undefined || !Number.isFinite(mape)) return 'LOW';
  if (historyDays >= 60 && mape < 15) return 'HIGH';
  if (historyDays >= 30 && mape < 30) return 'MEDIUM';
  return 'LOW';
}

export function generateForecast(
  series: TimeSeriesPoint[],
  horizonDays: number,
  method: ForecastMethodName,
): { date: Date; predictedValue: number }[] {
  const methodDef = METHODS.find((m) => m.name === method) ?? METHODS[0];
  const values = methodDef.predict(series, horizonDays);
  const lastDate = series[series.length - 1]?.date ?? new Date();

  return values.map((value, i) => ({
    date: new Date(lastDate.getTime() + (i + 1) * DAY_MS),
    predictedValue: Math.max(0, value),
  }));
}
