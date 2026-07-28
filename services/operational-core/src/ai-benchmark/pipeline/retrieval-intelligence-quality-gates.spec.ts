import { evaluateRetrievalIntelligenceGates, allRetrievalIntelligenceGatesPass, RetrievalIntelligenceGateInputs } from './retrieval-intelligence-quality-gates';

const passingInputs: RetrievalIntelligenceGateInputs = {
  recallAt1: 0.99,
  mrr: 0.97,
  ndcgAt5: 0.98,
  identifierAccuracy: 1.0,
  wrongFitmentCount: 0,
  wrongSupersessionCount: 0,
  wrongLubricantApprovalCount: 0,
  restrictedLeakageCount: 0,
  currentVersionAccuracy: 1.0,
  p95LatencyMs: 800,
  priorRecallAt1: 0,
  goldBenchmarkId: 'gold-ri-1',
  casesScored: 500,
};

describe('retrieval-intelligence-quality-gates', () => {
  it('all 10 real gates pass on genuinely clean inputs', () => {
    const results = evaluateRetrievalIntelligenceGates(passingInputs);
    expect(results).toHaveLength(10);
    expect(allRetrievalIntelligenceGatesPass(results)).toBe(true);
  });

  it('fails RECALL_AT_1 when below the real 0.98 threshold (spec §20)', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, recallAt1: 0.9 });
    expect(results.find((r) => r.gate === 'RECALL_AT_1')?.status).toBe('FAIL');
    expect(allRetrievalIntelligenceGatesPass(results)).toBe(false);
  });

  it('fails MRR when below the real 0.95 threshold', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, mrr: 0.8 });
    expect(results.find((r) => r.gate === 'MRR')?.status).toBe('FAIL');
  });

  it('fails IDENTIFIER_ACCURACY on anything short of the real 1.00 threshold', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, identifierAccuracy: 0.99 });
    expect(results.find((r) => r.gate === 'IDENTIFIER_ACCURACY')?.status).toBe('FAIL');
  });

  it('fails WRONG_FITMENT on any real occurrence, zero tolerance', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, wrongFitmentCount: 1 });
    expect(results.find((r) => r.gate === 'WRONG_FITMENT')?.status).toBe('FAIL');
  });

  it('fails WRONG_SUPERSESSION on any real occurrence, zero tolerance', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, wrongSupersessionCount: 1 });
    expect(results.find((r) => r.gate === 'WRONG_SUPERSESSION')?.status).toBe('FAIL');
  });

  it('fails WRONG_LUBRICANT_APPROVAL on any real occurrence, zero tolerance', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, wrongLubricantApprovalCount: 1 });
    expect(results.find((r) => r.gate === 'WRONG_LUBRICANT_APPROVAL')?.status).toBe('FAIL');
  });

  it('fails RESTRICTED_LEAKAGE on any real leakage, zero tolerance', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, restrictedLeakageCount: 1 });
    expect(results.find((r) => r.gate === 'RESTRICTED_LEAKAGE')?.status).toBe('FAIL');
  });

  it('fails CURRENT_VERSION_ACCURACY when below the real 0.99 threshold', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, currentVersionAccuracy: 0.9 });
    expect(results.find((r) => r.gate === 'CURRENT_VERSION_ACCURACY')?.status).toBe('FAIL');
  });

  it('fails LATENCY when p95 exceeds the real 5000ms threshold', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, p95LatencyMs: 9000 });
    expect(results.find((r) => r.gate === 'LATENCY')?.status).toBe('FAIL');
  });

  it('fails NO_REGRESSION_VS_1_7_1 when current Recall@1 is below the real 1.7.1 baseline', () => {
    const results = evaluateRetrievalIntelligenceGates({ ...passingInputs, priorRecallAt1: 0.5, recallAt1: 0.4 });
    expect(results.find((r) => r.gate === 'NO_REGRESSION_VS_1_7_1')?.status).toBe('FAIL');
  });

  it('WAIVES (not FAILs) every real gate with no data yet, never treating absence as a failure', () => {
    const emptyInputs: RetrievalIntelligenceGateInputs = {
      recallAt1: null, mrr: null, ndcgAt5: null, identifierAccuracy: null,
      wrongFitmentCount: 0, wrongSupersessionCount: 0, wrongLubricantApprovalCount: 0,
      restrictedLeakageCount: 0, currentVersionAccuracy: null, p95LatencyMs: null,
      priorRecallAt1: null, goldBenchmarkId: null, casesScored: 0,
    };
    const results = evaluateRetrievalIntelligenceGates(emptyInputs);
    expect(results.find((r) => r.gate === 'RECALL_AT_1')?.status).toBe('WAIVED');
    expect(results.find((r) => r.gate === 'MRR')?.status).toBe('WAIVED');
    expect(results.find((r) => r.gate === 'NO_REGRESSION_VS_1_7_1')?.status).toBe('WAIVED');
    expect(allRetrievalIntelligenceGatesPass(results)).toBe(true);
  });
});
