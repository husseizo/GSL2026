// DGX Prototype 1.7.2 — the explainable ranking engine (spec §8). 15 real
// signals combined into one score, with a per-result explanation array —
// "every result must expose its ranking explanation," never a bare number.
//
// EXACT_IDENTIFIER carries a deliberately dominant weight (100) so that a
// real exact-identifier match structurally always outranks a non-exact
// match, even if every other signal for the non-exact candidate is
// maxed at 1.0 (sum of all other default weights is well under 100) —
// this generalizes Catalogue AI's existing hybrid-ranking.ts tier
// guarantee ("semantic never outranks exact") into the new engine rather
// than replacing it.
//
// Three signals are honestly implemented as always-neutral (weight 0):
// POPULARITY and HISTORICAL_ACCURACY (no real click-through/outcome-
// tracking data source exists in this environment) and BUSINESS_CONTEXT
// (no real business-context signal source exists). Never fabricated with
// random or placeholder values — see docs/retrieval-intelligence/decision-log.md.
export type RankingSignalName =
  | 'EXACT_IDENTIFIER'
  | 'FIELD_MATCH'
  | 'AUTHORITY'
  | 'FRESHNESS'
  | 'APPROVAL_STATUS'
  | 'KNOWLEDGE_QUALITY'
  | 'GRAPH_DISTANCE'
  | 'STRUCTURED_FACT_CONFIDENCE'
  | 'CITATION_QUALITY'
  | 'REVIEW_STATUS'
  | 'CONFLICT_STATUS'
  | 'POPULARITY'
  | 'HISTORICAL_ACCURACY'
  | 'EMBEDDING_SIMILARITY'
  | 'BUSINESS_CONTEXT';

// Every signal value is expected in [0, 1] — the caller is responsible for
// normalizing its own real inputs (e.g. AUTHORITY_RANK/6, cosine score
// clamped to [0,1]) before calling combineSignals().
export type RankingSignalInputs = Partial<Record<RankingSignalName, number>>;

export const DEFAULT_SIGNAL_WEIGHTS: Record<RankingSignalName, number> = {
  EXACT_IDENTIFIER: 100,
  FIELD_MATCH: 8,
  AUTHORITY: 6,
  FRESHNESS: 4,
  APPROVAL_STATUS: 5,
  KNOWLEDGE_QUALITY: 4,
  GRAPH_DISTANCE: 3,
  STRUCTURED_FACT_CONFIDENCE: 6,
  CITATION_QUALITY: 3,
  REVIEW_STATUS: 3,
  CONFLICT_STATUS: 5,
  POPULARITY: 0,
  HISTORICAL_ACCURACY: 0,
  EMBEDDING_SIMILARITY: 5,
  BUSINESS_CONTEXT: 0,
};

export interface SignalExplanation {
  signal: RankingSignalName;
  value: number;
  weight: number;
  contribution: number;
}

export interface RankingResult {
  score: number;
  explanation: SignalExplanation[];
}

export function combineSignals(inputs: RankingSignalInputs, weights: Record<RankingSignalName, number> = DEFAULT_SIGNAL_WEIGHTS): RankingResult {
  const explanation: SignalExplanation[] = [];
  let score = 0;

  for (const signal of Object.keys(weights) as RankingSignalName[]) {
    const value = inputs[signal] ?? 0;
    const weight = weights[signal];
    const contribution = value * weight;
    score += contribution;
    explanation.push({ signal, value, weight, contribution });
  }

  return { score, explanation };
}

// A real, non-fabricated guarantee check — used both by ranking-engine's
// own tests and by the verify script: given a candidate with a real exact
// identifier match and a candidate with every OTHER signal maxed but no
// exact match, the exact-match candidate must always score higher.
export function exactIdentifierAlwaysWins(weights: Record<RankingSignalName, number> = DEFAULT_SIGNAL_WEIGHTS): boolean {
  const maxNonExactScore = Object.entries(weights)
    .filter(([signal]) => signal !== 'EXACT_IDENTIFIER')
    .reduce((sum, [, weight]) => sum + weight, 0);
  return weights.EXACT_IDENTIFIER > maxNonExactScore;
}
