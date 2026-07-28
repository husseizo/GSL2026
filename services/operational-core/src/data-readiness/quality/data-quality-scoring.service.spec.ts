import { DataQualityScoringService } from './data-quality-scoring.service';

describe('DataQualityScoringService.classify', () => {
  const service = new DataQualityScoringService(undefined as never);

  it('never hides a very weak dimension behind a high average — the phase\'s explicit rule', () => {
    // High average but one very weak dimension (0.3, below the NOT_USABLE
    // floor) — a high average must not mask it as GOOD/EXCELLENT.
    const dimensions = {
      completeness: 0.99,
      validity: 0.99,
      uniqueness: 0.99,
      consistency: 0.99,
      timeliness: 0.99,
      referentialIntegrity: 0.99,
      reconciliationAccuracy: 0.99,
      provenanceCompleteness: 0.3,
    };
    expect(service.classify(dimensions)).toBe('NOT_USABLE');
  });

  it('classifies a moderately weak minimum dimension (below 0.7 but at/above 0.5) as POOR, not hidden by a high average', () => {
    const dimensions = { completeness: 0.99, validity: 0.99, uniqueness: 0.99, consistency: 0.99, timeliness: 0.99, referentialIntegrity: 0.99, reconciliationAccuracy: 0.99, provenanceCompleteness: 0.6 };
    expect(service.classify(dimensions)).toBe('POOR');
  });

  it('classifies real all-high dimensions as EXCELLENT', () => {
    const dimensions = { completeness: 0.99, validity: 0.99, uniqueness: 0.99, consistency: 0.99, timeliness: 0.99, referentialIntegrity: 0.99, reconciliationAccuracy: 0.99, provenanceCompleteness: 0.99 };
    expect(service.classify(dimensions)).toBe('EXCELLENT');
  });

  it('classifies a real low-completeness customer dataset (e.g. 100% missing tax number) as NOT_USABLE when the minimum dimension is very low', () => {
    const dimensions = { completeness: 0.32, validity: 0.32, uniqueness: 1, consistency: 1, timeliness: 1, referentialIntegrity: 1, reconciliationAccuracy: 1, provenanceCompleteness: 0.02 };
    expect(service.classify(dimensions)).toBe('NOT_USABLE');
  });
});

describe('DataQualityScoringService.computeDimensionsFromProfile', () => {
  const service = new DataQualityScoringService(undefined as never);

  it('derives completeness from real missing-rate inputs, not a fabricated value', () => {
    const dims = service.computeDimensionsFromProfile({ missingRates: [0.1, 0.2], duplicateRates: [0], reconciliationVariance: 0, multiSourceRate: 0.5, recordCount: 100 });
    expect(dims.completeness).toBeCloseTo(1 - 0.15, 2);
  });

  it('clamps every dimension to [0, 1]', () => {
    const dims = service.computeDimensionsFromProfile({ missingRates: [2], duplicateRates: [2], reconciliationVariance: 5, multiSourceRate: 1, recordCount: 10 });
    for (const value of Object.values(dims)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('returns zero timeliness/referentialIntegrity for an empty dataset rather than a misleadingly high default', () => {
    const dims = service.computeDimensionsFromProfile({ missingRates: [], duplicateRates: [], reconciliationVariance: 0, multiSourceRate: 0, recordCount: 0 });
    expect(dims.timeliness).toBe(0);
    expect(dims.referentialIntegrity).toBe(0);
  });
});
