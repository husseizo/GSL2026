import { classifyForecastEligibility } from './forecast-eligibility';
import { TimeSeriesPoint } from '../../forecasting/forecast-math';

function series(values: number[]): TimeSeriesPoint[] {
  return values.map((value, i) => ({ date: new Date(2026, 0, i + 1), value }));
}

describe('classifyForecastEligibility', () => {
  const base = { minHistoryDays: 30, minNonZeroPeriods: 10, hasUnresolvedIdentityConflict: false, lastActivityDaysAgo: 1, discontinuedAfterDays: 60 };

  it('flags IDENTITY_CONFLICT before anything else, regardless of history', () => {
    const result = classifyForecastEligibility({ ...base, series: series(Array(90).fill(5)), hasUnresolvedIdentityConflict: true });
    expect(result).toBe('IDENTITY_CONFLICT');
  });

  it('flags DISCONTINUED when the item has had no real activity for longer than the discontinued threshold', () => {
    const result = classifyForecastEligibility({ ...base, series: series(Array(90).fill(5)), lastActivityDaysAgo: 90 });
    expect(result).toBe('DISCONTINUED');
  });

  it('flags INSUFFICIENT_HISTORY for a real short-history item', () => {
    const result = classifyForecastEligibility({ ...base, series: series(Array(10).fill(5)) });
    expect(result).toBe('INSUFFICIENT_HISTORY');
  });

  it('flags DATA_GAP when history is long enough but real non-zero periods are too few', () => {
    const values = Array(90).fill(0);
    values[0] = 5;
    const result = classifyForecastEligibility({ ...base, series: series(values) });
    expect(result).toBe('DATA_GAP');
  });

  it('flags INTERMITTENT_DEMAND for a real sparse-but-sufficient series', () => {
    const values = Array(90).fill(0).map((_, i) => (i % 5 === 0 ? 3 : 0));
    const result = classifyForecastEligibility({ ...base, series: series(values) });
    expect(result).toBe('INTERMITTENT_DEMAND');
  });

  it('flags FORECAST_ELIGIBLE for a real dense, sufficient series', () => {
    const values = Array(90).fill(4);
    const result = classifyForecastEligibility({ ...base, series: series(values) });
    expect(result).toBe('FORECAST_ELIGIBLE');
  });
});
