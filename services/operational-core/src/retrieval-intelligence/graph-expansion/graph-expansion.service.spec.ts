import { GraphExpansionService } from './graph-expansion.service';

describe('GraphExpansionService.graphDistanceSignal', () => {
  it('scores depth 1 (direct neighbor) as the maximum signal value', () => {
    expect(GraphExpansionService.graphDistanceSignal(1)).toBe(1);
  });

  it('decays monotonically with real BFS depth, never going negative', () => {
    const d1 = GraphExpansionService.graphDistanceSignal(1);
    const d2 = GraphExpansionService.graphDistanceSignal(2);
    const d4 = GraphExpansionService.graphDistanceSignal(4);
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d4);
    expect(d4).toBeGreaterThanOrEqual(0);
  });

  it('treats depth 0 (the seed itself) as the maximum signal value', () => {
    expect(GraphExpansionService.graphDistanceSignal(0)).toBe(1);
  });

  it('never returns a negative value even beyond the max bounded depth', () => {
    expect(GraphExpansionService.graphDistanceSignal(10, 4)).toBeGreaterThanOrEqual(0);
  });
});
