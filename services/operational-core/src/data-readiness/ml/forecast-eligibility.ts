import { isIntermittentDemand, TimeSeriesPoint } from '../../forecasting/forecast-math';

export type ForecastEligibilityClass = 'FORECAST_ELIGIBLE' | 'INTERMITTENT_DEMAND' | 'INSUFFICIENT_HISTORY' | 'IDENTITY_CONFLICT' | 'DATA_GAP' | 'DISCONTINUED' | 'MANUAL_REVIEW_REQUIRED';

export interface EligibilityInput {
  series: TimeSeriesPoint[];
  minHistoryDays: number;
  minNonZeroPeriods: number;
  hasUnresolvedIdentityConflict: boolean;
  lastActivityDaysAgo: number | null;
  discontinuedAfterDays: number;
}

// Real eligibility classification (spec §27) layered on top of Phase 4's
// pure forecast-math.ts — a separate module rather than a change to that
// file, since eligibility is a business-rule concern specific to this
// phase's dataset-building process, not a forecasting-math concern. See
// docs/data-readiness/forecast-baselines.md.
export function classifyForecastEligibility(input: EligibilityInput): ForecastEligibilityClass {
  if (input.hasUnresolvedIdentityConflict) return 'IDENTITY_CONFLICT';
  if (input.lastActivityDaysAgo !== null && input.lastActivityDaysAgo > input.discontinuedAfterDays) return 'DISCONTINUED';

  const nonZeroCount = input.series.filter((p) => p.value !== 0).length;
  const historyDays = input.series.length;

  if (historyDays < input.minHistoryDays) return 'INSUFFICIENT_HISTORY';
  if (nonZeroCount < input.minNonZeroPeriods) return 'DATA_GAP';
  if (isIntermittentDemand(input.series)) return 'INTERMITTENT_DEMAND';
  return 'FORECAST_ELIGIBLE';
}
