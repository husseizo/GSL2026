// Pure ranking-priority logic — no DB, no embeddings. See
// docs/ai/parts-search-ranking.md.
import { MatchType } from './catalogue-search.service';

// Real, fixed priority order the spec requires: "Do not allow semantic
// similarity to outrank an exact verified OEM-number match." Lower number =
// ranked first, always, regardless of any numeric score — this is a strict
// tier ordering, not a weighted blend, precisely because a weighted blend
// is what would let a high semantic score outrank a real exact match.
const MATCH_TYPE_PRIORITY: Record<MatchType, number> = {
  EXACT_INTERNAL_CODE: 1,
  EXACT_OEM: 2,
  EXACT_ALTERNATE: 3,
  VERIFIED_SUPERSESSION: 4,
  EXACT_TECDOC: 5,
  VERIFIED_FITMENT: 6,
  KEYWORD_MATCH: 7,
  SEMANTIC_MATCH: 8,
  POSSIBLE_ALTERNATIVE: 9,
  CONFLICTING_MATCH: 9,
  INSUFFICIENT_EVIDENCE: 10,
};

export interface RankableHit {
  canonicalEntityId: string;
  matchType: MatchType;
  matchScore: number;
}

// Sorts strictly by match-type tier first, matchScore only as a tiebreaker
// within the same tier — the structural guarantee that a
// SEMANTIC_MATCH can never precede an EXACT_OEM hit, no matter how high its
// cosine similarity is.
export function rankHybridResults<T extends RankableHit>(hits: T[]): T[] {
  return [...hits].sort((a, b) => {
    const priorityDiff = MATCH_TYPE_PRIORITY[a.matchType] - MATCH_TYPE_PRIORITY[b.matchType];
    if (priorityDiff !== 0) return priorityDiff;
    return b.matchScore - a.matchScore;
  });
}

export function isExactTier(matchType: MatchType): boolean {
  return MATCH_TYPE_PRIORITY[matchType] <= MATCH_TYPE_PRIORITY.EXACT_TECDOC;
}
