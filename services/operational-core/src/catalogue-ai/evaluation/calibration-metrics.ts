// Confidence calibration metrics (DGX Prototype 1.5) — pure functions, no
// DB, no model calls. See docs/ai-tuning/confidence-calibration.md.
//
// Every catalogue confidence band (VERIFIED/HIGH/MEDIUM/LOW/CONFLICTING/
// INSUFFICIENT_EVIDENCE) is mapped to a real point probability for these
// calculations — a rough anchor (not a trained calibration curve, which
// would need far more labeled outcome data than exists in this
// environment), documented here rather than left implicit.
export const CONFIDENCE_BAND_PROBABILITY: Record<string, number> = {
  VERIFIED: 0.99,
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.4,
  CONFLICTING: 0.3,
  INSUFFICIENT_EVIDENCE: 0.1,
};

export interface CalibrationSample {
  confidenceLevel: string;
  wasCorrect: boolean;
}

export interface ReliabilityBin {
  band: string;
  predictedProbability: number;
  observedAccuracy: number;
  sampleCount: number;
}

// One row per real confidence band actually observed in the sample —
// compares the band's assumed probability against the real fraction of
// samples in that band that were actually correct.
export function reliabilityDiagram(samples: CalibrationSample[]): ReliabilityBin[] {
  const byBand = new Map<string, CalibrationSample[]>();
  for (const s of samples) {
    const list = byBand.get(s.confidenceLevel) ?? [];
    list.push(s);
    byBand.set(s.confidenceLevel, list);
  }

  return [...byBand.entries()].map(([band, bandSamples]) => ({
    band,
    predictedProbability: CONFIDENCE_BAND_PROBABILITY[band] ?? 0.5,
    observedAccuracy: bandSamples.filter((s) => s.wasCorrect).length / bandSamples.length,
    sampleCount: bandSamples.length,
  }));
}

// Expected Calibration Error — weighted average absolute gap between
// predicted probability and observed accuracy across bands.
export function expectedCalibrationError(samples: CalibrationSample[]): number {
  if (samples.length === 0) return 0;
  const bins = reliabilityDiagram(samples);
  const weightedError = bins.reduce((sum, bin) => sum + bin.sampleCount * Math.abs(bin.predictedProbability - bin.observedAccuracy), 0);
  return Math.round((weightedError / samples.length) * 10000) / 10000;
}

// Brier score — mean squared error between predicted probability and the
// real binary outcome (1 = correct, 0 = incorrect). Lower is better.
export function brierScore(samples: CalibrationSample[]): number {
  if (samples.length === 0) return 0;
  const sumSquaredError = samples.reduce((sum, s) => {
    const predicted = CONFIDENCE_BAND_PROBABILITY[s.confidenceLevel] ?? 0.5;
    const actual = s.wasCorrect ? 1 : 0;
    return sum + (predicted - actual) ** 2;
  }, 0);
  return Math.round((sumSquaredError / samples.length) * 10000) / 10000;
}
