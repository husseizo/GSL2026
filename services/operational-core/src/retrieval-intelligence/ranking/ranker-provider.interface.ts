// DGX Prototype 1.7.2 — the Learning-to-Rank abstraction (spec §10). Spec's
// explicit rule: "Do not implement machine-learned ranking yet. Instead
// design an abstraction allowing future support for XGBoost/LightGBM/
// CatBoost/neural rerankers/cross-encoders without changing retrieval
// APIs." Mirrors the existing VectorIndexProvider seam pattern
// (src/vector-search/vector-search.service.ts) exactly: one interface, one
// real implementation today, documented (never implemented) future
// implementations.
import { RankingSignalInputs, RankingResult, combineSignals } from './ranking-engine';

export interface RankerProvider {
  readonly name: string;
  rank(inputs: RankingSignalInputs): RankingResult;
}

// The only real implementation today — the deterministic, explainable
// weighted-signal combiner. Every future ranker (XGBoost/LightGBM/
// CatBoost gradient-boosted trees over these same 15 signals as features;
// a neural cross-encoder re-scoring the top-N candidates) would implement
// this same interface without any retrieval API changing — see
// docs/retrieval-intelligence/ranking.md for the documented (not built)
// seam.
export class HeuristicRankerProvider implements RankerProvider {
  readonly name = 'HEURISTIC_WEIGHTED_SIGNALS';

  rank(inputs: RankingSignalInputs): RankingResult {
    return combineSignals(inputs);
  }
}
