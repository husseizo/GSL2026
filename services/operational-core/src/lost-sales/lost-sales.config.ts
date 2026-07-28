// Deterministic rule thresholds — deliberately not hardcoded inline inside
// the detection logic, so they can be tuned/overridden without touching
// LostSalesEngine. See docs/architecture/lost-sales-detection.md.
export interface LostSalesRulesConfig {
  sessionWindowMinutes: number;
  repeatSearchThreshold: number;
  candidateExpirationDays: number;
  minEstimatedValueForHighConfidence: number;
}

export const DEFAULT_LOST_SALES_CONFIG: LostSalesRulesConfig = {
  sessionWindowMinutes: 30,
  repeatSearchThreshold: 3,
  candidateExpirationDays: 14,
  minEstimatedValueForHighConfidence: 0,
};

export const LOST_SALES_CONFIG = 'LOST_SALES_CONFIG';
