import { evaluateTrustedKnowledgeGates, allTrustedKnowledgeGatesPass, TrustedKnowledgeGateInputs } from './trusted-knowledge-quality-gates';

const passingInputs: TrustedKnowledgeGateInputs = {
  exactIdentifierRecallAt1: 1.0,
  mrr: 0.95,
  citationCorrectness: 0.99,
  unsupportedClaimRate: 0.0,
  restrictedLeakageCount: 0,
  expiredCurrentAnswerRate: 0,
  injectionRefusalAccuracy: 1.0,
  goldBenchmarkId: 'gold-1',
  allGoldCasesApproved: true,
  allHighRiskFactsDualReviewed: true,
  unresolvedHighSeverityConflictsCount: 0,
};

describe('trusted-knowledge-quality-gates', () => {
  it('all 8 real gates pass on genuinely clean inputs', () => {
    const results = evaluateTrustedKnowledgeGates(passingInputs);
    expect(results).toHaveLength(8);
    expect(allTrustedKnowledgeGatesPass(results)).toBe(true);
    expect(results.every((r) => r.status === 'PASS')).toBe(true);
  });

  it('fails EXACT_IDENTIFIER_RECALL when Recall@1 is below the real 1.00 threshold', () => {
    const results = evaluateTrustedKnowledgeGates({ ...passingInputs, exactIdentifierRecallAt1: 0.9 });
    expect(results.find((r) => r.gate === 'EXACT_IDENTIFIER_RECALL')?.status).toBe('FAIL');
    expect(allTrustedKnowledgeGatesPass(results)).toBe(false);
  });

  it('fails RESTRICTED_LEAKAGE on any real leakage, zero tolerance', () => {
    const results = evaluateTrustedKnowledgeGates({ ...passingInputs, restrictedLeakageCount: 1 });
    expect(results.find((r) => r.gate === 'RESTRICTED_LEAKAGE')?.status).toBe('FAIL');
  });

  it('fails GOLD_HUMAN_APPROVAL when a high-risk fact still needs dual review', () => {
    const results = evaluateTrustedKnowledgeGates({ ...passingInputs, allHighRiskFactsDualReviewed: false });
    expect(results.find((r) => r.gate === 'GOLD_HUMAN_APPROVAL')?.status).toBe('FAIL');
  });

  it('fails GOLD_HUMAN_APPROVAL when an unresolved high-severity conflict remains', () => {
    const results = evaluateTrustedKnowledgeGates({ ...passingInputs, unresolvedHighSeverityConflictsCount: 1 });
    expect(results.find((r) => r.gate === 'GOLD_HUMAN_APPROVAL')?.status).toBe('FAIL');
  });

  it('WAIVES (never FAILs) gates with no real data yet — honest, not a false failure', () => {
    const emptyInputs: TrustedKnowledgeGateInputs = { ...passingInputs, exactIdentifierRecallAt1: null, mrr: null, citationCorrectness: null, unsupportedClaimRate: null, expiredCurrentAnswerRate: null, goldBenchmarkId: null };
    const results = evaluateTrustedKnowledgeGates(emptyInputs);
    expect(results.find((r) => r.gate === 'EXACT_IDENTIFIER_RECALL')?.status).toBe('WAIVED');
    expect(results.find((r) => r.gate === 'GOLD_HUMAN_APPROVAL')?.status).toBe('WAIVED');
    expect(allTrustedKnowledgeGatesPass(results)).toBe(true);
  });

  it('never fails RESTRICTED_LEAKAGE/INJECTION_REFUSAL_ACCURACY via WAIVER — these are always evaluated, zero-tolerance by design', () => {
    const results = evaluateTrustedKnowledgeGates(passingInputs);
    expect(results.find((r) => r.gate === 'RESTRICTED_LEAKAGE')?.status).not.toBe('WAIVED');
    expect(results.find((r) => r.gate === 'INJECTION_REFUSAL_ACCURACY')?.status).not.toBe('WAIVED');
  });
});
