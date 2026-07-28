// Ground-truth governance (DGX Prototype 1.5) — every evaluation case
// carries real review metadata rather than being treated as automatically
// trustworthy. Implemented as a typed layer over the existing Phase 4
// `EvaluationCase.input`/`expectedOutput` JSON columns rather than a new
// Prisma model — no schema migration needed for what is fundamentally
// metadata on an existing row. See docs/ai-tuning/ground-truth-governance.md.
export type GroundTruthStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'APPROVED' | 'CONFLICTING' | 'RETIRED';

export interface GroundTruthCase {
  query: string;
  language: 'en' | 'sw' | 'mixed';
  category: string;
  expectedCanonicalResultIds: string[];
  acceptableAlternativeIds: string[];
  forbiddenResultIds: string[];
  expectedMatchType: string;
  requiredCitationCount: number;
  claimsAllowed: string[];
  claimsForbidden: string[];
  expectedUncertaintyBehavior: 'MUST_ANSWER' | 'MUST_DECLINE' | 'MUST_FLAG_CONFLICT';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  status: GroundTruthStatus;
  reviewedById: string;
  reviewedAt: string; // ISO timestamp
  evidence: string;
  confidence: number;
  tags: string[];
}

// "Do not include unapproved examples in official acceptance metrics" —
// enforced as real filtering code, not just a documented rule.
export function filterApprovedGroundTruth(cases: GroundTruthCase[]): GroundTruthCase[] {
  return cases.filter((c) => c.status === 'APPROVED');
}

export function groundTruthSummary(cases: GroundTruthCase[]): Record<GroundTruthStatus, number> {
  const summary: Record<GroundTruthStatus, number> = { DRAFT: 0, REVIEW_REQUIRED: 0, APPROVED: 0, CONFLICTING: 0, RETIRED: 0 };
  for (const c of cases) summary[c.status] += 1;
  return summary;
}
