// DGX Prototype 1.7.2 — strategy selection (spec §4 stage 6, §7). A pure
// decision table: given a classified query, choose which of the 13
// strategies to run and which hybrid mode governs ranking — never "run
// every strategy for every query" (spec §7's explicit rule).
//
// PERMISSION_AWARE_SEARCH, FRESHNESS_AWARE_SEARCH, and CONFLICT_AWARE_SEARCH
// are always included regardless of query class — these are compliance-
// critical pipeline stages (permission filtering, freshness validation,
// conflict awareness), not optional relevance strategies, so they are
// never conditionally skipped.
import { ClassifiedQuery } from '../query-understanding/query-classifier';
import { RetrievalStrategyName, HybridRetrievalMode } from './strategy-catalog';

export interface StrategySelection {
  strategies: RetrievalStrategyName[];
  mode: HybridRetrievalMode;
}

const ALWAYS_ON_STRATEGIES: RetrievalStrategyName[] = ['PERMISSION_AWARE_SEARCH', 'FRESHNESS_AWARE_SEARCH', 'CONFLICT_AWARE_SEARCH'];

const IDENTIFIER_SHAPED_CLASSES = new Set([
  'OEM_PART_NUMBER', 'INTERNAL_ITEM_CODE', 'TECDOC_ARTICLE', 'BARCODE', 'SKU',
  'VEHICLE_VIN', 'ENGINE_CODE', 'TRANSMISSION_CODE', 'LUBRICANT_APPROVAL',
  'LUBRICANT_PRODUCT', 'FAULT_CODE',
]);

export function selectRetrievalStrategy(classified: ClassifiedQuery): StrategySelection {
  // Exact-identifier-shaped classes: try deterministic exact/normalized/
  // alias lookup first, per spec §6 ("identifier lookup must always
  // execute before semantic search"). Graph expansion is added on top
  // (never instead of) the exact match, per spec §15.
  if (IDENTIFIER_SHAPED_CLASSES.has(classified.queryClass)) {
    return {
      strategies: [...ALWAYS_ON_STRATEGIES, 'EXACT_MATCH', 'NORMALIZED_MATCH', 'ALIAS_MATCH', 'PREFIX_MATCH', 'GRAPH_EXPANSION'],
      mode: 'HYBRID_GRAPH_AUTHORITY_STRUCTURED_FACTS',
    };
  }

  // Typo/approximate-search: the same exact-lookup family plus a fuzzy/
  // field-match fallback, since the query is presumed close to (but not
  // exactly) a real identifier.
  if (classified.queryClass === 'TYPO' || classified.queryClass === 'APPROXIMATE_SEARCH') {
    return {
      strategies: [...ALWAYS_ON_STRATEGIES, 'NORMALIZED_MATCH', 'ALIAS_MATCH', 'FIELD_MATCH', 'VECTOR_SEARCH'],
      mode: 'HYBRID',
    };
  }

  // Free-text / language / mixed classes: no exact identifier to anchor
  // on, so candidate generation leans on hybrid keyword+vector search,
  // widened with graph expansion and every ranking signal available —
  // this is exactly the path 1.7.1 found under-served (zero graph
  // integration, zero structured-fact awareness).
  if (
    classified.queryClass === 'FREE_TEXT_QUESTION' ||
    classified.queryClass === 'SWAHILI' ||
    classified.queryClass === 'ENGLISH' ||
    classified.queryClass === 'MIXED_LANGUAGE' ||
    classified.queryClass === 'MIXED_QUERY' ||
    classified.queryClass === 'VEHICLE_MODEL' ||
    classified.queryClass === 'TECHNICAL_PROCEDURE'
  ) {
    return {
      strategies: [...ALWAYS_ON_STRATEGIES, 'FIELD_MATCH', 'HYBRID_SEARCH', 'VECTOR_SEARCH', 'SEMANTIC_SEARCH', 'GRAPH_EXPANSION', 'HISTORICAL_SEARCH'],
      mode: 'HYBRID_GRAPH_AUTHORITY_STRUCTURED_FACTS',
    };
  }

  // UNKNOWN — no real basis for a targeted strategy; fall back to plain
  // vector search rather than guessing.
  return {
    strategies: [...ALWAYS_ON_STRATEGIES, 'VECTOR_SEARCH'],
    mode: 'VECTOR',
  };
}
