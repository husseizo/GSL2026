import { MODE_ACTIVATIONS } from './strategy-catalog';

describe('strategy-catalog', () => {
  it('IDENTIFIER_ONLY mode activates no graph/authority/structured-fact/LTR signals', () => {
    const mode = MODE_ACTIVATIONS.IDENTIFIER_ONLY;
    expect(mode.graphExpansion).toBe(false);
    expect(mode.authoritySignal).toBe(false);
    expect(mode.structuredFactSignal).toBe(false);
    expect(mode.ltrSignal).toBe(false);
  });

  it('HYBRID_GRAPH_AUTHORITY_LTR is the richest mode — every signal active', () => {
    const mode = MODE_ACTIVATIONS.HYBRID_GRAPH_AUTHORITY_LTR;
    expect(mode.graphExpansion).toBe(true);
    expect(mode.authoritySignal).toBe(true);
    expect(mode.freshnessSignal).toBe(true);
    expect(mode.structuredFactSignal).toBe(true);
    expect(mode.ltrSignal).toBe(true);
  });

  it('every mode declares at least one candidate-generation source', () => {
    for (const mode of Object.values(MODE_ACTIVATIONS)) {
      expect(mode.candidateGeneration.length).toBeGreaterThan(0);
    }
  });
});
