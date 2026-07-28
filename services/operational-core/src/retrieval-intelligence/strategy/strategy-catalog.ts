// DGX Prototype 1.7.2 — the 13 retrieval strategies (spec §7) and the 10
// hybrid retrieval modes (spec §9), as typed unions. RetrievalStrategyMode
// mirrors the Prisma enum of the same name exactly (kept as a plain TS
// union here too so pure functions in this module don't need a Prisma
// import).
export type RetrievalStrategyName =
  | 'EXACT_MATCH'
  | 'FIELD_MATCH'
  | 'PREFIX_MATCH'
  | 'NORMALIZED_MATCH'
  | 'ALIAS_MATCH'
  | 'GRAPH_EXPANSION'
  | 'HYBRID_SEARCH'
  | 'VECTOR_SEARCH'
  | 'SEMANTIC_SEARCH'
  | 'HISTORICAL_SEARCH'
  | 'CONFLICT_AWARE_SEARCH'
  | 'PERMISSION_AWARE_SEARCH'
  | 'FRESHNESS_AWARE_SEARCH';

export type HybridRetrievalMode =
  | 'IDENTIFIER_ONLY'
  | 'BM25'
  | 'VECTOR'
  | 'HYBRID'
  | 'HYBRID_GRAPH'
  | 'HYBRID_GRAPH_AUTHORITY'
  | 'HYBRID_GRAPH_AUTHORITY_FRESHNESS'
  | 'HYBRID_GRAPH_AUTHORITY_FIELD_BOOST'
  | 'HYBRID_GRAPH_AUTHORITY_STRUCTURED_FACTS'
  | 'HYBRID_GRAPH_AUTHORITY_LTR';

// Declarative stage-activation flags per mode — "strategies must be
// benchmarked rather than assumed" (spec §9's own words): this table is
// the thing retrieval-lab.service.ts benchmarks across, never a hardcoded
// assumption about which mode is "best."
export interface ModeActivation {
  candidateGeneration: ('IDENTIFIER' | 'KEYWORD_BM25' | 'VECTOR')[];
  graphExpansion: boolean;
  authoritySignal: boolean;
  freshnessSignal: boolean;
  fieldBoostSignal: boolean;
  structuredFactSignal: boolean;
  ltrSignal: boolean;
}

export const MODE_ACTIVATIONS: Record<HybridRetrievalMode, ModeActivation> = {
  IDENTIFIER_ONLY: { candidateGeneration: ['IDENTIFIER'], graphExpansion: false, authoritySignal: false, freshnessSignal: false, fieldBoostSignal: false, structuredFactSignal: false, ltrSignal: false },
  BM25: { candidateGeneration: ['KEYWORD_BM25'], graphExpansion: false, authoritySignal: false, freshnessSignal: false, fieldBoostSignal: true, structuredFactSignal: false, ltrSignal: false },
  VECTOR: { candidateGeneration: ['VECTOR'], graphExpansion: false, authoritySignal: false, freshnessSignal: false, fieldBoostSignal: false, structuredFactSignal: false, ltrSignal: false },
  HYBRID: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: false, authoritySignal: false, freshnessSignal: false, fieldBoostSignal: true, structuredFactSignal: false, ltrSignal: false },
  HYBRID_GRAPH: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: true, authoritySignal: false, freshnessSignal: false, fieldBoostSignal: true, structuredFactSignal: false, ltrSignal: false },
  HYBRID_GRAPH_AUTHORITY: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: true, authoritySignal: true, freshnessSignal: false, fieldBoostSignal: true, structuredFactSignal: false, ltrSignal: false },
  HYBRID_GRAPH_AUTHORITY_FRESHNESS: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: true, authoritySignal: true, freshnessSignal: true, fieldBoostSignal: true, structuredFactSignal: false, ltrSignal: false },
  HYBRID_GRAPH_AUTHORITY_FIELD_BOOST: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: true, authoritySignal: true, freshnessSignal: true, fieldBoostSignal: true, structuredFactSignal: false, ltrSignal: false },
  HYBRID_GRAPH_AUTHORITY_STRUCTURED_FACTS: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: true, authoritySignal: true, freshnessSignal: true, fieldBoostSignal: true, structuredFactSignal: true, ltrSignal: false },
  // LTR mode activates the ranker-provider seam (ranking/ranker-provider.interface.ts)
  // — still backed by HeuristicRankerProvider today (spec §10: "do not
  // implement machine-learned ranking yet"), never a real learned model.
  HYBRID_GRAPH_AUTHORITY_LTR: { candidateGeneration: ['IDENTIFIER', 'KEYWORD_BM25', 'VECTOR'], graphExpansion: true, authoritySignal: true, freshnessSignal: true, fieldBoostSignal: true, structuredFactSignal: true, ltrSignal: true },
};
