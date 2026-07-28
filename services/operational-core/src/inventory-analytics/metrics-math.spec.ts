import { AbcClass, MovementClass, XyzClass } from '@prisma/client';
import { DEFAULT_CLASSIFICATION_CONFIG } from './classification.config';
import { classifyAbc, classifyMovement, classifyXyz, computeDemandStats } from './metrics-math';

describe('computeDemandStats', () => {
  it('returns zeros for an empty window', () => {
    expect(computeDemandStats([])).toEqual({ avgDailyDemand: 0, stdDev: 0, coefficientOfVariation: null });
  });

  it('computes mean/stddev over a window that includes zero-sale days (sparse demand)', () => {
    // 10 days, only 2 had sales (5 units each) — sparse demand must not be
    // averaged only over the days that sold something.
    const daily = [5, 0, 0, 0, 0, 0, 0, 0, 0, 5];
    const stats = computeDemandStats(daily);
    expect(stats.avgDailyDemand).toBeCloseTo(1.0);
    expect(stats.coefficientOfVariation).not.toBeNull();
  });

  it('returns a null coefficient of variation when mean demand is zero', () => {
    const stats = computeDemandStats([0, 0, 0]);
    expect(stats.avgDailyDemand).toBe(0);
    expect(stats.coefficientOfVariation).toBeNull();
  });
});

describe('classifyXyz', () => {
  it('classifies stable demand as X', () => {
    expect(classifyXyz(0.2, DEFAULT_CLASSIFICATION_CONFIG)).toBe(XyzClass.X);
  });

  it('classifies moderately variable demand as Y', () => {
    expect(classifyXyz(0.8, DEFAULT_CLASSIFICATION_CONFIG)).toBe(XyzClass.Y);
  });

  it('classifies highly variable/intermittent demand as Z', () => {
    expect(classifyXyz(1.5, DEFAULT_CLASSIFICATION_CONFIG)).toBe(XyzClass.Z);
  });

  it('returns null when coefficient of variation is undefined (no demand)', () => {
    expect(classifyXyz(null, DEFAULT_CLASSIFICATION_CONFIG)).toBeNull();
  });
});

describe('classifyMovement', () => {
  it('classifies a brand-new item as NEW_ITEM, not INSUFFICIENT_HISTORY', () => {
    const result = classifyMovement({
      historyDays: 10,
      salesLast30d: 0,
      salesLast90d: 0,
      noMovementDays: 10,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.NEW_ITEM);
  });

  it('classifies insufficient history distinctly once past the new-item window', () => {
    const result = classifyMovement({
      historyDays: 25, // >30d new-item window in config, <30 min-history threshold
      salesLast30d: 0,
      salesLast90d: 0,
      noMovementDays: 25,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.INSUFFICIENT_HISTORY);
  });

  it('classifies long-untouched stock as DEAD_STOCK ahead of NON_MOVING', () => {
    const result = classifyMovement({
      historyDays: 400,
      salesLast30d: 0,
      salesLast90d: 0,
      noMovementDays: 200,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.DEAD_STOCK);
  });

  it('classifies moderately stale stock as NON_MOVING', () => {
    const result = classifyMovement({
      historyDays: 400,
      salesLast30d: 0,
      salesLast90d: 0,
      noMovementDays: 100,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.NON_MOVING);
  });

  it('classifies frequently-sold items as FAST_MOVING', () => {
    const result = classifyMovement({
      historyDays: 400,
      salesLast30d: 10,
      salesLast90d: 25,
      noMovementDays: 1,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.FAST_MOVING);
  });

  it('classifies rarely-sold-but-active items as SLOW_MOVING', () => {
    const result = classifyMovement({
      historyDays: 400,
      salesLast30d: 0,
      salesLast90d: 1,
      noMovementDays: 5,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.SLOW_MOVING);
  });

  it('classifies everything else as MEDIUM_MOVING', () => {
    const result = classifyMovement({
      historyDays: 400,
      salesLast30d: 2,
      salesLast90d: 6,
      noMovementDays: 5,
      config: DEFAULT_CLASSIFICATION_CONFIG,
    });
    expect(result).toBe(MovementClass.MEDIUM_MOVING);
  });
});

describe('classifyAbc', () => {
  it('assigns A to items making up the top cumulative 80% of consumption value', () => {
    const items = [
      { key: 'big', consumptionValue: 800 },
      { key: 'medium', consumptionValue: 150 },
      { key: 'small', consumptionValue: 50 },
    ];
    const result = classifyAbc(items, DEFAULT_CLASSIFICATION_CONFIG);
    expect(result.get('big')).toBe(AbcClass.A);
    expect(result.get('medium')).toBe(AbcClass.B);
    expect(result.get('small')).toBe(AbcClass.C);
  });

  it('treats all items as C when total consumption value is zero (no false precision)', () => {
    const items = [
      { key: 'a', consumptionValue: 0 },
      { key: 'b', consumptionValue: 0 },
    ];
    const result = classifyAbc(items, DEFAULT_CLASSIFICATION_CONFIG);
    expect(result.get('a')).toBe(AbcClass.C);
    expect(result.get('b')).toBe(AbcClass.C);
  });

  it('is stable regardless of input order', () => {
    const itemsA = [
      { key: 'x', consumptionValue: 10 },
      { key: 'y', consumptionValue: 90 },
    ];
    const itemsB = [
      { key: 'y', consumptionValue: 90 },
      { key: 'x', consumptionValue: 10 },
    ];
    expect(classifyAbc(itemsA, DEFAULT_CLASSIFICATION_CONFIG).get('y')).toBe(
      classifyAbc(itemsB, DEFAULT_CLASSIFICATION_CONFIG).get('y'),
    );
  });
});
