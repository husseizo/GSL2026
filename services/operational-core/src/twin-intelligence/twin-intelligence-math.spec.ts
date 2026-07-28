import {
  classifySystem,
  computeMaintenanceRiskScore,
  computeOverallConfidence,
  computePredictedMaintenance,
  computeServiceCompliance,
  computeSystemRisks,
  computeVehicleHealthScore,
  computeWarrantyRisk,
  predictRecurrences,
} from './twin-intelligence-math';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-11T00:00:00Z');

describe('classifySystem', () => {
  it('classifies cooling-related text', () => {
    expect(classifySystem('Replaced water pump and thermostat')).toBe('COOLING');
  });
  it('classifies brake-related text', () => {
    expect(classifySystem('Front brake pads worn to metal')).toBe('BRAKE');
  });
  it('falls back to OTHER for unrelated text', () => {
    expect(classifySystem('Replaced cabin air filter')).toBe('OTHER');
  });
});

describe('computeSystemRisks', () => {
  it('scores LOW for a system with no evidence', () => {
    const risks = computeSystemRisks([], NOW);
    expect(risks.BRAKE.riskLevel).toBe('LOW');
    expect(risks.BRAKE.riskScore).toBe(0);
  });

  it('scores HIGH for a system with 3+ recent incidents', () => {
    const events = [
      { text: 'brake pad replacement', occurredAt: new Date(NOW.getTime() - 30 * DAY) },
      { text: 'brake rotor warped', occurredAt: new Date(NOW.getTime() - 60 * DAY) },
      { text: 'brake caliper stuck', occurredAt: new Date(NOW.getTime() - 90 * DAY) },
    ];
    const risks = computeSystemRisks(events, NOW);
    expect(risks.BRAKE.riskLevel).toBe('HIGH');
    expect(risks.BRAKE.evidenceCount).toBe(3);
  });

  it('ignores evidence outside the 12-month window', () => {
    const events = [{ text: 'brake pad replacement', occurredAt: new Date(NOW.getTime() - 400 * DAY) }];
    const risks = computeSystemRisks(events, NOW);
    expect(risks.BRAKE.evidenceCount).toBe(0);
  });
});

describe('computeVehicleHealthScore', () => {
  it('returns 100 when every system risk is zero', () => {
    const risks = computeSystemRisks([], NOW);
    expect(computeVehicleHealthScore(risks)).toBe(100);
  });

  it('decreases as system risk increases', () => {
    const clean = computeSystemRisks([], NOW);
    const risky = computeSystemRisks(
      [
        { text: 'brake pad replacement', occurredAt: new Date(NOW.getTime() - 10 * DAY) },
        { text: 'engine misfire', occurredAt: new Date(NOW.getTime() - 20 * DAY) },
      ],
      NOW,
    );
    expect(computeVehicleHealthScore(risky)).toBeLessThan(computeVehicleHealthScore(clean));
  });
});

describe('computeMaintenanceRiskScore', () => {
  it('increases with repeat-repair flag count', () => {
    const risks = computeSystemRisks([], NOW);
    const withoutFlags = computeMaintenanceRiskScore(risks, 0);
    const withFlags = computeMaintenanceRiskScore(risks, 3);
    expect(withFlags).toBeGreaterThan(withoutFlags);
  });
});

describe('computeWarrantyRisk', () => {
  it('returns 0 when there are no jobs at all', () => {
    expect(computeWarrantyRisk(0, 0, 0)).toBe(0);
  });

  it('increases with warranty candidate flags and warranty job ratio', () => {
    const low = computeWarrantyRisk(0, 10, 0);
    const high = computeWarrantyRisk(5, 10, 2);
    expect(high).toBeGreaterThan(low);
  });
});

describe('computeOverallConfidence', () => {
  it('flags fewer than 2 jobs as INSUFFICIENT_HISTORY', () => {
    expect(computeOverallConfidence(0)).toBe('INSUFFICIENT_HISTORY');
    expect(computeOverallConfidence(1)).toBe('INSUFFICIENT_HISTORY');
  });
  it('reaches HIGH only at 10+ jobs', () => {
    expect(computeOverallConfidence(9)).toBe('MEDIUM');
    expect(computeOverallConfidence(10)).toBe('HIGH');
  });
});

describe('computeServiceCompliance', () => {
  it('returns INSUFFICIENT_HISTORY with fewer than 2 events', () => {
    const result = computeServiceCompliance([{ occurredAt: NOW }]);
    expect(result.confidence).toBe('INSUFFICIENT_HISTORY');
    expect(result.score).toBeNull();
  });

  it('scores 100 when every interval is within the target', () => {
    const result = computeServiceCompliance(
      [
        { occurredAt: new Date('2026-01-01') },
        { occurredAt: new Date('2026-06-01') },
      ],
      180,
    );
    expect(result.score).toBe(100);
  });

  it('scores lower when intervals exceed the target', () => {
    const result = computeServiceCompliance(
      [
        { occurredAt: new Date('2025-01-01') },
        { occurredAt: new Date('2026-06-01') },
      ],
      180,
    );
    expect(result.score).toBeLessThan(100);
  });
});

describe('predictRecurrences', () => {
  it('projects the next occurrence from the average interval of past ones', () => {
    const events = [
      { key: 'part-1', label: 'Ignition Coil', occurredAt: new Date('2025-01-01') },
      { key: 'part-1', label: 'Ignition Coil', occurredAt: new Date('2025-07-01') },
    ];
    const predictions = predictRecurrences(events);
    expect(predictions).toHaveLength(1);
    expect(predictions[0].occurrenceCount).toBe(2);
    expect(predictions[0].predictedNextDate.getTime()).toBeGreaterThan(new Date('2025-07-01').getTime());
  });

  it('does not predict anything for an item replaced only once', () => {
    const events = [{ key: 'part-2', label: 'Water Pump', occurredAt: new Date('2025-01-01') }];
    expect(predictRecurrences(events)).toHaveLength(0);
  });
});

describe('computePredictedMaintenance', () => {
  it('omits LOW-risk systems entirely', () => {
    const risks = computeSystemRisks([], NOW);
    expect(computePredictedMaintenance(risks)).toHaveLength(0);
  });

  it('includes a recommendation with evidence count for a risky system', () => {
    const risks = computeSystemRisks(
      [
        { text: 'brake pad worn', occurredAt: new Date(NOW.getTime() - 10 * DAY) },
        { text: 'brake rotor scored', occurredAt: new Date(NOW.getTime() - 20 * DAY) },
        { text: 'brake fluid leak', occurredAt: new Date(NOW.getTime() - 30 * DAY) },
      ],
      NOW,
    );
    const recs = computePredictedMaintenance(risks);
    expect(recs[0].system).toBe('BRAKE');
    expect(recs[0].riskLevel).toBe('HIGH');
    expect(recs[0].evidenceCount).toBe(3);
    expect(recs[0].recommendation).toContain('brake');
  });
});
