import { selectWinner } from './metric-selection';

describe('selectWinner', () => {
  it('picks the arm with the highest real value for a HIGHER_IS_BETTER metric', () => {
    const result = selectWinner(
      [
        { armId: 'a', label: 'A', metrics: { avgGroundedness: 0.6 } },
        { armId: 'b', label: 'B', metrics: { avgGroundedness: 0.9 } },
      ],
      'avgGroundedness',
      'HIGHER_IS_BETTER',
    );
    expect(result.winnerArmId).toBe('b');
  });

  it('picks the arm with the lowest real value for a LOWER_IS_BETTER metric', () => {
    const result = selectWinner(
      [
        { armId: 'a', label: 'A', metrics: { avgUnsupportedClaimRate: 0.3 } },
        { armId: 'b', label: 'B', metrics: { avgUnsupportedClaimRate: 0.05 } },
      ],
      'avgUnsupportedClaimRate',
      'LOWER_IS_BETTER',
    );
    expect(result.winnerArmId).toBe('b');
  });

  it('reads a nested dotted path', () => {
    const result = selectWinner(
      [
        { armId: 'a', label: 'A', metrics: { citation: { correctness: 0.8 } } },
        { armId: 'b', label: 'B', metrics: { citation: { correctness: 0.95 } } },
      ],
      'citation.correctness',
    );
    expect(result.winnerArmId).toBe('b');
  });

  it('returns null with an honest reason when no arm has a real value for the metric', () => {
    const result = selectWinner([{ armId: 'a', label: 'A', metrics: {} }], 'nonexistentMetric');
    expect(result.winnerArmId).toBeNull();
    expect(result.reason).toContain('no arm produced a real value');
  });
});
