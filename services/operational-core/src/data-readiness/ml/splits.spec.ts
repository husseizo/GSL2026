import { entityGroupedSplit, timeBasedSplit } from './splits';

describe('timeBasedSplit', () => {
  it('splits chronologically with train always earliest, test always most recent', () => {
    const records = Array.from({ length: 100 }, (_, i) => ({ date: new Date(2026, 0, i + 1), value: i }));
    const result = timeBasedSplit(records, 10, 10);

    expect(result.train.length + result.validation.length + result.test.length).toBe(100);
    const trainMax = Math.max(...result.train.map((r) => r.date.getTime()));
    const valMin = Math.min(...result.validation.map((r) => r.date.getTime()));
    const valMax = Math.max(...result.validation.map((r) => r.date.getTime()));
    const testMin = Math.min(...result.test.map((r) => r.date.getTime()));

    expect(trainMax).toBeLessThan(valMin);
    expect(valMax).toBeLessThan(testMin);
  });

  it('handles an empty input without throwing', () => {
    const result = timeBasedSplit([], 10, 10);
    expect(result.train).toHaveLength(0);
    expect(result.validation).toHaveLength(0);
    expect(result.test).toHaveLength(0);
  });

  it('returns real, usable boundaries that can be recorded for reproducibility', () => {
    const records = Array.from({ length: 30 }, (_, i) => ({ date: new Date(2026, 0, i + 1), value: i }));
    const result = timeBasedSplit(records, 5, 5);
    expect(result.boundaries.trainEnd.getTime()).toBeLessThan(result.boundaries.validationStart.getTime());
    expect(result.boundaries.validationEnd.getTime()).toBeLessThan(result.boundaries.testStart.getTime());
  });
});

describe('entityGroupedSplit', () => {
  it('never splits the same entity across train and test', () => {
    const records = Array.from({ length: 50 }, (_, i) => ({ entityId: `entity-${i % 10}`, value: i }));
    const { train, test } = entityGroupedSplit(records, 0.3);

    const trainEntities = new Set(train.map((r) => r.entityId));
    const testEntities = new Set(test.map((r) => r.entityId));
    const overlap = [...trainEntities].filter((e) => testEntities.has(e));
    expect(overlap).toHaveLength(0);
  });

  it('is deterministic for the same seed', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ entityId: `entity-${i}`, value: i }));
    const first = entityGroupedSplit(records, 0.25, 'seed-a');
    const second = entityGroupedSplit(records, 0.25, 'seed-a');
    expect(first.test.map((r) => r.entityId)).toEqual(second.test.map((r) => r.entityId));
  });

  it('produces a different split for a different seed', () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ entityId: `entity-${i}`, value: i }));
    const a = entityGroupedSplit(records, 0.25, 'seed-a');
    const b = entityGroupedSplit(records, 0.25, 'seed-b');
    expect(a.test.map((r) => r.entityId)).not.toEqual(b.test.map((r) => r.entityId));
  });
});
