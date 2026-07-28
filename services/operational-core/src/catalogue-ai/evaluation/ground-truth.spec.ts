import { filterApprovedGroundTruth, GroundTruthCase, groundTruthSummary } from './ground-truth';

function makeCase(overrides: Partial<GroundTruthCase>): GroundTruthCase {
  return {
    query: 'test',
    language: 'en',
    category: 'EXACT_OEM',
    expectedCanonicalResultIds: ['id-1'],
    acceptableAlternativeIds: [],
    forbiddenResultIds: [],
    expectedMatchType: 'EXACT_OEM',
    requiredCitationCount: 1,
    claimsAllowed: [],
    claimsForbidden: [],
    expectedUncertaintyBehavior: 'MUST_ANSWER',
    difficulty: 'EASY',
    status: 'APPROVED',
    reviewedById: 'system-self-consistency',
    reviewedAt: new Date().toISOString(),
    evidence: 'real catalogue row',
    confidence: 1,
    tags: [],
    ...overrides,
  };
}

describe('filterApprovedGroundTruth', () => {
  it('keeps only APPROVED cases, excluding DRAFT/REVIEW_REQUIRED/CONFLICTING/RETIRED', () => {
    const cases = [
      makeCase({ status: 'APPROVED' }),
      makeCase({ status: 'DRAFT' }),
      makeCase({ status: 'REVIEW_REQUIRED' }),
      makeCase({ status: 'CONFLICTING' }),
      makeCase({ status: 'RETIRED' }),
    ];
    expect(filterApprovedGroundTruth(cases)).toHaveLength(1);
  });
});

describe('groundTruthSummary', () => {
  it('counts real cases per status', () => {
    const cases = [makeCase({ status: 'APPROVED' }), makeCase({ status: 'APPROVED' }), makeCase({ status: 'REVIEW_REQUIRED' })];
    expect(groundTruthSummary(cases)).toEqual({ DRAFT: 0, REVIEW_REQUIRED: 1, APPROVED: 2, CONFLICTING: 0, RETIRED: 0 });
  });
});
