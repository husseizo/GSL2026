import { brierScore, expectedCalibrationError, reliabilityDiagram } from './calibration-metrics';

describe('reliabilityDiagram', () => {
  it('groups real samples by confidence band and computes observed accuracy per band', () => {
    const samples = [
      { confidenceLevel: 'HIGH', wasCorrect: true },
      { confidenceLevel: 'HIGH', wasCorrect: true },
      { confidenceLevel: 'HIGH', wasCorrect: false },
      { confidenceLevel: 'LOW', wasCorrect: false },
    ];
    const bins = reliabilityDiagram(samples);
    const highBin = bins.find((b) => b.band === 'HIGH')!;
    expect(highBin.sampleCount).toBe(3);
    expect(highBin.observedAccuracy).toBeCloseTo(2 / 3);
  });
});

describe('expectedCalibrationError', () => {
  it('is 0 for a perfectly calibrated set (VERIFIED band, all correct)', () => {
    const samples = Array.from({ length: 10 }, () => ({ confidenceLevel: 'VERIFIED', wasCorrect: true }));
    // VERIFIED assumes 0.99 probability — 100% observed accuracy is very close, real small gap expected
    expect(expectedCalibrationError(samples)).toBeLessThan(0.02);
  });

  it('is large when a HIGH-confidence band is actually mostly wrong', () => {
    const samples = [
      { confidenceLevel: 'HIGH', wasCorrect: false },
      { confidenceLevel: 'HIGH', wasCorrect: false },
      { confidenceLevel: 'HIGH', wasCorrect: false },
    ];
    expect(expectedCalibrationError(samples)).toBeGreaterThan(0.5);
  });

  it('is 0 for an empty sample set', () => {
    expect(expectedCalibrationError([])).toBe(0);
  });
});

describe('brierScore', () => {
  it('is low for a well-calibrated, mostly-correct high-confidence set', () => {
    const samples = Array.from({ length: 10 }, () => ({ confidenceLevel: 'HIGH', wasCorrect: true }));
    expect(brierScore(samples)).toBeLessThan(0.05);
  });

  it('is high for a confidently-wrong set', () => {
    const samples = [{ confidenceLevel: 'VERIFIED', wasCorrect: false }];
    expect(brierScore(samples)).toBeGreaterThan(0.9);
  });
});
