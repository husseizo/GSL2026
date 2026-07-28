// Reranker evaluation (DGX Prototype 1.5) — pure functions only, no DB, no
// model calls, so they can be run head-to-head against the same real
// retrieved-candidate lists inside the offline evaluation harness. See
// docs/ai-tuning/reranker-evaluation.md for the real comparison results
// and why a cross-encoder reranker is honestly out of reach in this
// environment (no locally-deployable cross-encoder model is available).
export interface RerankCandidate {
  id: string;
  score: number; // raw retrieval score (e.g. cosine similarity)
}

export type RerankerName = 'CURRENT_HEURISTIC' | 'RECIPROCAL_RANK_FUSION' | 'NO_RERANKER';

// The current, already-shipped approach (Prototype 1): no separate
// reranking stage — candidates keep the vector-search's own score order.
// Included here as the "NO_RERANKER" baseline for comparison.
export function noRerank(candidates: RerankCandidate[]): RerankCandidate[] {
  return [...candidates];
}

// Reciprocal Rank Fusion — combines multiple ranked lists (e.g. a keyword
// search ranking and a semantic ranking of the same candidate pool) into
// one fused ranking, using each list's RANK rather than its raw score
// (scores from different retrieval methods are not on comparable scales;
// ranks are). RRF score for a document = sum over each list it appears in
// of 1/(k + rank). A real, standard, well-documented technique — not
// invented for this project.
const RRF_K = 60; // the standard constant from the original RRF paper; not tuned per-dataset here given the small real eval sample available

export function reciprocalRankFusion(rankedLists: RerankCandidate[][]): RerankCandidate[] {
  const fusedScores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((candidate, index) => {
      const rank = index + 1;
      const contribution = 1 / (RRF_K + rank);
      fusedScores.set(candidate.id, (fusedScores.get(candidate.id) ?? 0) + contribution);
    });
  }
  return [...fusedScores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

export function applyReranker(name: RerankerName, rankedLists: RerankCandidate[][]): RerankCandidate[] {
  if (name === 'NO_RERANKER') return noRerank(rankedLists[0] ?? []);
  if (name === 'RECIPROCAL_RANK_FUSION') return reciprocalRankFusion(rankedLists);
  return noRerank(rankedLists[0] ?? []); // CURRENT_HEURISTIC is hybrid-ranking.ts's strict tier order, evaluated separately since it operates on MatchType, not raw scores — see reranker-evaluation.md
}
