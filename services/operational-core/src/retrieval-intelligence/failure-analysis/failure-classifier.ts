// DGX Prototype 1.7.2 — the failure taxonomy (spec §19). A pure function
// over a completed retrieval outcome + its expected answer — "every
// failure becomes a benchmark candidate," never silently discarded.
export type RetrievalFailureTypeValue =
  | 'WRONG_IDENTIFIER'
  | 'WRONG_RANKING'
  | 'MISSING_EMBEDDING'
  | 'MISSING_GRAPH'
  | 'WRONG_SNAPSHOT'
  | 'WRONG_CITATION'
  | 'PERMISSION_ERROR'
  | 'CONFLICT_ERROR'
  | 'FRESHNESS_ERROR'
  | 'NO_RESULT'
  | 'FALSE_RESULT';

export interface FailureClassificationInput {
  expectedEntityId?: string | null;
  expectedNoAnswer?: boolean;
  topCandidateId?: string | null;
  candidateRank?: number | null; // rank (0-based) of the expected entity among returned candidates, null if absent
  candidateCount: number;
  isIdentifierClass: boolean;
  hasEmbeddingScore: boolean;
  graphExpansionExpected: boolean;
  graphExpansionRan: boolean;
  hasActiveSnapshot: boolean;
  citationResolved: boolean;
  permissionDenied: boolean;
  hasOpenConflict: boolean;
  freshnessExcluded: boolean;
}

// Ordered, deterministic — the first matching real cause wins, mirroring
// the same "ordered rule list, first match wins" discipline used by
// classifyRetrievalQuery(). Returns null when the outcome was correct
// (no real failure to classify).
export function classifyRetrievalFailure(input: FailureClassificationInput): RetrievalFailureTypeValue | null {
  const correct = input.expectedNoAnswer ? input.candidateCount === 0 : input.candidateRank === 0;
  if (correct) return null;

  if (input.permissionDenied) return 'PERMISSION_ERROR';
  if (input.freshnessExcluded) return 'FRESHNESS_ERROR';
  if (input.hasOpenConflict) return 'CONFLICT_ERROR';
  if (!input.hasActiveSnapshot) return 'WRONG_SNAPSHOT';
  if (!input.citationResolved) return 'WRONG_CITATION';

  if (input.expectedNoAnswer && input.candidateCount > 0) return 'FALSE_RESULT';
  if (!input.expectedNoAnswer && input.candidateCount === 0) return 'NO_RESULT';

  if (input.isIdentifierClass && input.topCandidateId !== input.expectedEntityId) return 'WRONG_IDENTIFIER';
  if (input.graphExpansionExpected && !input.graphExpansionRan) return 'MISSING_GRAPH';
  if (!input.isIdentifierClass && !input.hasEmbeddingScore) return 'MISSING_EMBEDDING';

  // The expected entity was returned but not ranked first — a real
  // ranking-quality failure, not a missing-data failure.
  if (input.candidateRank !== null && input.candidateRank !== undefined && input.candidateRank > 0) return 'WRONG_RANKING';

  return 'WRONG_RANKING';
}
