import { checkFeatureTimestampPrecedesTarget, checkNoEntityOverlap, checkNoTemporalOverlap, checkProhibitedFieldsAbsent, runAllLeakageChecks } from './leakage-checks';

describe('checkFeatureTimestampPrecedesTarget', () => {
  it('passes when every feature is observed strictly before its target', () => {
    const result = checkFeatureTimestampPrecedesTarget([{ entityId: 'a', featureTimestamp: new Date('2026-01-01'), targetTimestamp: new Date('2026-01-02') }]);
    expect(result.passed).toBe(true);
  });

  it('fails and reports the real leakage scenario: using future sales to predict earlier demand', () => {
    const result = checkFeatureTimestampPrecedesTarget([{ entityId: 'a', featureTimestamp: new Date('2026-01-05'), targetTimestamp: new Date('2026-01-02') }]);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('1 record(s)');
  });
});

describe('checkNoTemporalOverlap', () => {
  it('passes when train ends before test begins', () => {
    const result = checkNoTemporalOverlap([{ date: new Date('2026-01-01') }], [{ date: new Date('2026-02-01') }]);
    expect(result.passed).toBe(true);
  });

  it('fails on real overlap', () => {
    const result = checkNoTemporalOverlap([{ date: new Date('2026-02-05') }], [{ date: new Date('2026-02-01') }]);
    expect(result.passed).toBe(false);
  });

  it('does not throw on an empty train or test bucket (a real short-history item edge case)', () => {
    expect(() => checkNoTemporalOverlap([], [{ date: new Date('2026-02-01') }])).not.toThrow();
    expect(checkNoTemporalOverlap([], []).passed).toBe(true);
  });
});

describe('checkNoEntityOverlap', () => {
  it('fails when an entity appears in both train and test', () => {
    const result = checkNoEntityOverlap([{ entityId: 'cust-1' }], [{ entityId: 'cust-1' }]);
    expect(result.passed).toBe(false);
  });

  it('passes when entities are disjoint', () => {
    const result = checkNoEntityOverlap([{ entityId: 'cust-1' }], [{ entityId: 'cust-2' }]);
    expect(result.passed).toBe(true);
  });
});

describe('checkProhibitedFieldsAbsent', () => {
  it('detects the real leakage scenario: final approval status present in a feature set predicting that approval', () => {
    const result = checkProhibitedFieldsAbsent([{ finalApprovalStatus: 'APPROVED' }], ['finalApprovalStatus']);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('finalApprovalStatus');
  });

  it('passes when none of the prohibited fields are present', () => {
    const result = checkProhibitedFieldsAbsent([{ quantity: 5 }], ['finalApprovalStatus', 'paymentCompletedAt']);
    expect(result.passed).toBe(true);
  });
});

describe('runAllLeakageChecks', () => {
  it('runs only the checks whose inputs were provided', () => {
    const results = runAllLeakageChecks({ entitySplit: { train: [{ entityId: 'a' }], test: [{ entityId: 'b' }] } });
    expect(results).toHaveLength(1);
    expect(results[0].checkName).toBe('no_entity_overlap');
  });
});
