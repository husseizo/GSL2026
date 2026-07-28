// Pure, automated leakage checks — no DB, no I/O. See
// docs/data-readiness/leakage-prevention.md for the real leakage scenarios
// this phase's own data could produce if not checked.
export interface LeakageCheckResult {
  checkName: string;
  passed: boolean;
  detail: string;
}

export interface FeatureRecord {
  entityId: string;
  featureTimestamp: Date;
  targetTimestamp: Date;
  [key: string]: unknown;
}

// A feature must be observable strictly before the target it's predicting
// — this is the single most common real leakage bug (spec's "using future
// sales to predict earlier demand," "using future warehouse balances").
export function checkFeatureTimestampPrecedesTarget(records: FeatureRecord[]): LeakageCheckResult {
  const violations = records.filter((r) => r.featureTimestamp.getTime() >= r.targetTimestamp.getTime());
  return {
    checkName: 'feature_precedes_target',
    passed: violations.length === 0,
    detail: violations.length === 0 ? 'Every feature timestamp is strictly before its target timestamp' : `${violations.length} record(s) have a feature timestamp at or after the target timestamp`,
  };
}

// Splits must not overlap in time — a record in train must never share a
// date with a record in test (see splits.ts). Checked independently here
// so a leakage-check pass can be run against ANY split output, not just
// ones produced by timeBasedSplit().
export function checkNoTemporalOverlap(train: { date: Date }[], test: { date: Date }[]): LeakageCheckResult {
  // An empty train or test bucket (short-history items legitimately
  // produce these) has no real overlap to check — reported as a pass with
  // an honest "empty" detail rather than crashing on an infinite date.
  if (train.length === 0 || test.length === 0) {
    return { checkName: 'no_temporal_overlap', passed: true, detail: `Train (${train.length} records) or test (${test.length} records) is empty — no overlap possible` };
  }

  const trainMax = Math.max(...train.map((r) => r.date.getTime()));
  const testMin = Math.min(...test.map((r) => r.date.getTime()));
  const passed = trainMax < testMin;
  return {
    checkName: 'no_temporal_overlap',
    passed,
    detail: passed ? `Train ends before test begins (train max ${new Date(trainMax).toISOString()} < test min ${new Date(testMin).toISOString()})` : `Train/test date ranges overlap (train max ${new Date(trainMax).toISOString()} >= test min ${new Date(testMin).toISOString()})`,
  };
}

// No entity may appear in both the train and test split of an
// entity-grouped split (spec's "using canonical merge decisions... near-
// duplicate records appearing in both training and testing").
export function checkNoEntityOverlap(train: { entityId: string }[], test: { entityId: string }[]): LeakageCheckResult {
  const trainIds = new Set(train.map((r) => r.entityId));
  const overlap = test.filter((r) => trainIds.has(r.entityId));
  return {
    checkName: 'no_entity_overlap',
    passed: overlap.length === 0,
    detail: overlap.length === 0 ? 'No entity appears in both train and test' : `${overlap.length} record(s) belong to an entity present in both train and test`,
  };
}

// A field is prohibited outright if it can only be known after the
// prediction moment — e.g. final approval status, payment completion,
// post-outcome notes. This check looks for any of a caller-supplied
// prohibited-field list actually present (non-null) in the feature set.
export function checkProhibitedFieldsAbsent(records: Record<string, unknown>[], prohibitedFields: string[]): LeakageCheckResult {
  const found: string[] = [];
  for (const field of prohibitedFields) {
    if (records.some((r) => r[field] !== undefined && r[field] !== null)) found.push(field);
  }
  return {
    checkName: 'prohibited_fields_absent',
    passed: found.length === 0,
    detail: found.length === 0 ? 'None of the prohibited post-outcome fields are present' : `Prohibited field(s) present in feature set: ${found.join(', ')}`,
  };
}

export function runAllLeakageChecks(params: {
  featureRecords?: FeatureRecord[];
  timeSplit?: { train: { date: Date }[]; test: { date: Date }[] };
  entitySplit?: { train: { entityId: string }[]; test: { entityId: string }[] };
  rawFeatureRecords?: Record<string, unknown>[];
  prohibitedFields?: string[];
}): LeakageCheckResult[] {
  const results: LeakageCheckResult[] = [];
  if (params.featureRecords) results.push(checkFeatureTimestampPrecedesTarget(params.featureRecords));
  if (params.timeSplit) results.push(checkNoTemporalOverlap(params.timeSplit.train, params.timeSplit.test));
  if (params.entitySplit) results.push(checkNoEntityOverlap(params.entitySplit.train, params.entitySplit.test));
  if (params.rawFeatureRecords && params.prohibitedFields) results.push(checkProhibitedFieldsAbsent(params.rawFeatureRecords, params.prohibitedFields));
  return results;
}
