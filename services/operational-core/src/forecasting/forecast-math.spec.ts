import {
  backtestAndCompare,
  buildDailySeries,
  computeErrorMetrics,
  computeForecastConfidence,
  crostonForecast,
  exponentialSmoothingForecast,
  generateForecast,
  isIntermittentDemand,
  movingAverageForecast,
  naiveForecast,
  pickBestMethod,
  seasonalNaiveForecast,
  TimeSeriesPoint,
} from './forecast-math';

const DAY = 24 * 60 * 60 * 1000;

describe('buildDailySeries', () => {
  it('zero-fills days with no events rather than skipping them', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-05');
    const events = [{ date: new Date('2026-01-03'), quantity: 5 }];
    const series = buildDailySeries(events, start, end);
    expect(series).toHaveLength(5);
    expect(series.map((p) => p.value)).toEqual([0, 0, 5, 0, 0]);
  });

  it('sums multiple events on the same day', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-01-01');
    const events = [
      { date: new Date('2026-01-01T08:00:00Z'), quantity: 2 },
      { date: new Date('2026-01-01T18:00:00Z'), quantity: 3 },
    ];
    expect(buildDailySeries(events, start, end)[0].value).toBe(5);
  });
});

describe('forecast methods', () => {
  const series: TimeSeriesPoint[] = [1, 2, 3, 4, 5, 6, 7].map((v, i) => ({ date: new Date(Date.now() + i * DAY), value: v }));

  it('naiveForecast repeats the last observed value', () => {
    expect(naiveForecast(series, 3)).toEqual([7, 7, 7]);
  });

  it('movingAverageForecast averages the trailing window', () => {
    const result = movingAverageForecast(series, 2, 7);
    expect(result[0]).toBeCloseTo(4, 5); // mean of 1..7
  });

  it('exponentialSmoothingForecast weights recent values more heavily than the naive average', () => {
    const smoothed = exponentialSmoothingForecast(series, 1, 0.5)[0];
    const average = movingAverageForecast(series, 1, 7)[0];
    expect(smoothed).toBeGreaterThan(average); // upward trend, so smoothing tracks closer to recent (higher) values
  });

  it('seasonalNaiveForecast repeats the same weekday pattern', () => {
    const result = seasonalNaiveForecast(series, 7, 7);
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('computeErrorMetrics', () => {
  it('returns zero error for a perfect forecast', () => {
    const metrics = computeErrorMetrics([10, 20, 30], [10, 20, 30]);
    expect(metrics.mape).toBe(0);
    expect(metrics.rmse).toBe(0);
    expect(metrics.mae).toBe(0);
    expect(metrics.bias).toBe(0);
  });

  it('computes positive bias when forecasts consistently over-predict', () => {
    const metrics = computeErrorMetrics([10, 10, 10], [15, 15, 15]);
    expect(metrics.bias).toBeGreaterThan(0);
    expect(metrics.mae).toBe(5);
  });

  it('skips zero-actual days for MAPE without breaking RMSE/MAE', () => {
    const metrics = computeErrorMetrics([0, 10], [2, 10]);
    expect(Number.isFinite(metrics.mape)).toBe(true); // only the second day counts
    expect(metrics.rmse).toBeGreaterThan(0); // first day's error of 2 still counts here
  });

  // DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2):
  // testActualSum is the real, persisted evidence a later certification
  // gate needs to verify zero business activity — must be exactly 0 for
  // an all-zero actual test window, and a real, positive sum otherwise.
  describe('testActualSum (Amendment v1.1 evidence field)', () => {
    it('is exactly 0 when every real actual value in the test window is zero', () => {
      const metrics = computeErrorMetrics([0, 0, 0, 0], [1, 1, 1, 1]);
      expect(metrics.testActualSum).toBe(0);
    });

    it('is the real sum of absolute actual values when real activity exists', () => {
      const metrics = computeErrorMetrics([0, 5, 0, 3], [0, 0, 0, 0]);
      expect(metrics.testActualSum).toBe(8);
    });

    it('is unaffected by negative-signed prediction error (uses actual values only, never predicted)', () => {
      const metrics = computeErrorMetrics([2, 2], [100, 100]);
      expect(metrics.testActualSum).toBe(4);
    });
  });
});

describe('backtestAndCompare / pickBestMethod', () => {
  it('returns an evaluation per method and picks the lowest-error one', () => {
    const flat: TimeSeriesPoint[] = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.now() + i * DAY), value: 10 }));
    const evaluations = backtestAndCompare(flat, 7);
    expect(evaluations).toHaveLength(5); // NAIVE, MOVING_AVERAGE, EXPONENTIAL_SMOOTHING, SEASONAL_NAIVE, CROSTON
    const best = pickBestMethod(evaluations);
    expect(best).not.toBeNull();
    expect(best!.mape).toBeCloseTo(0, 5); // a perfectly flat series should be predicted near-perfectly by every method
  });

  it('returns an empty array when there is not enough history for the holdout window', () => {
    const short: TimeSeriesPoint[] = [{ date: new Date(), value: 5 }];
    expect(backtestAndCompare(short, 7)).toEqual([]);
  });

  it('pickBestMethod returns null for an empty evaluation list', () => {
    expect(pickBestMethod([])).toBeNull();
  });
});

describe('computeForecastConfidence', () => {
  it('flags fewer than 14 days of history as INSUFFICIENT_DATA regardless of accuracy', () => {
    expect(computeForecastConfidence(10, 2)).toBe('INSUFFICIENT_DATA');
  });

  it('requires both long history and low error for HIGH confidence', () => {
    expect(computeForecastConfidence(90, 10)).toBe('HIGH');
    expect(computeForecastConfidence(20, 5)).not.toBe('HIGH'); // accurate but too little history
  });

  it('returns LOW when MAPE is undefined (all-zero actuals) even with long history', () => {
    expect(computeForecastConfidence(90, undefined)).toBe('LOW');
  });
});

describe('generateForecast', () => {
  it('produces horizonDays future points with dates after the last historical date', () => {
    const series: TimeSeriesPoint[] = [1, 2, 3].map((v, i) => ({ date: new Date(2026, 0, i + 1), value: v }));
    const forecast = generateForecast(series, 5, 'NAIVE');
    expect(forecast).toHaveLength(5);
    expect(forecast[0].date.getTime()).toBeGreaterThan(series[series.length - 1].date.getTime());
    expect(forecast[0].predictedValue).toBe(3);
  });

  it('never predicts a negative value', () => {
    const series: TimeSeriesPoint[] = [{ date: new Date(), value: -5 }];
    const forecast = generateForecast(series, 1, 'NAIVE');
    expect(forecast[0].predictedValue).toBe(0);
  });
});

// Data Validation & Business Baselining phase additions.
describe('crostonForecast', () => {
  it('returns zero for an all-zero series', () => {
    const series: TimeSeriesPoint[] = Array.from({ length: 10 }, (_, i) => ({ date: new Date(2026, 0, i + 1), value: 0 }));
    expect(crostonForecast(series, 3)).toEqual([0, 0, 0]);
  });

  it('produces a positive, non-spiky forecast for a real intermittent series (occasional real sales, mostly zero days)', () => {
    const values = [0, 0, 0, 5, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 6];
    const series: TimeSeriesPoint[] = values.map((v, i) => ({ date: new Date(2026, 0, i + 1), value: v }));
    const forecast = crostonForecast(series, 3);
    expect(forecast[0]).toBeGreaterThan(0);
    // Croston's rate-per-day is bounded by the real observed demand sizes —
    // never wildly exceeding the largest real sale.
    expect(forecast[0]).toBeLessThan(6);
  });
});

describe('isIntermittentDemand', () => {
  it('flags a real series with many zero-demand days', () => {
    const values = Array(20).fill(0).map((_, i) => (i % 4 === 0 ? 5 : 0));
    const series: TimeSeriesPoint[] = values.map((v, i) => ({ date: new Date(2026, 0, i + 1), value: v }));
    expect(isIntermittentDemand(series)).toBe(true);
  });

  it('does not flag a dense series', () => {
    const series: TimeSeriesPoint[] = Array.from({ length: 20 }, (_, i) => ({ date: new Date(2026, 0, i + 1), value: 5 }));
    expect(isIntermittentDemand(series)).toBe(false);
  });
});

describe('computeErrorMetrics — WAPE and MASE (must not rely on MAPE alone)', () => {
  it('WAPE stays well-defined even when many actual values are zero (unlike MAPE)', () => {
    const actual = [0, 0, 10, 0, 0];
    const predicted = [1, 1, 9, 1, 1];
    const metrics = computeErrorMetrics(actual, predicted);
    expect(Number.isFinite(metrics.wape)).toBe(true);
    expect(Number.isNaN(metrics.mape)).toBe(false); // MAPE is still computed over the one non-zero point here, but WAPE is the one meant to be trusted overall
  });

  it('MASE below 1 means the model beats a naive one-step-ahead forecast', () => {
    const actual = [10, 12, 11, 13, 12];
    const predicted = [10, 12, 11, 13, 12]; // a perfect forecast
    const metrics = computeErrorMetrics(actual, predicted);
    expect(metrics.mase).toBe(0);
  });
});

describe('pickBestMethod ranks by WAPE, not MAPE', () => {
  it('prefers the method with lower WAPE even when MAPE would suggest otherwise on a zero-heavy series', () => {
    const evaluations = [
      { method: 'NAIVE' as const, mape: NaN, rmse: 5, mae: 4, bias: 0, wape: 80, mase: 1.2, testActualSum: 10 },
      { method: 'CROSTON' as const, mape: NaN, rmse: 6, mae: 3, bias: 0, wape: 40, mase: 0.8, testActualSum: 10 },
    ];
    const best = pickBestMethod(evaluations);
    expect(best?.method).toBe('CROSTON');
  });
});
