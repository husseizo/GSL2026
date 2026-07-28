// Pure catalogue-specific confidence banding — layered on top of Phase 4's
// generic computeRetrievalConfidence() (HIGH/MEDIUM/LOW/NONE), not a
// replacement for it. See docs/ai/confidence-model.md.
import { MatchType } from './search/catalogue-search.service';

export type CatalogueConfidenceLevel = 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CONFLICTING' | 'INSUFFICIENT_EVIDENCE';

export interface ConfidenceInputs {
  matchType: MatchType | null;
  sourceCount: number;
  hasConflict: boolean;
  isVerified: boolean;
  retrievalScore?: number;
  dataQualityScore?: number;
  manualReviewPending: boolean;
}

// Deliberately not a single blended numeric score presented with false
// precision (spec §24: "Do not present numerical confidence with false
// precision unless calibrated") — a discrete band, with the real inputs
// that produced it always attached so a caller/UI can show its reasoning.
export function computeCatalogueConfidence(inputs: ConfidenceInputs): { level: CatalogueConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [];

  if (inputs.hasConflict) {
    reasons.push('Underlying source records disagree (e.g. conflicting category/brand for the same identifier)');
    return { level: 'CONFLICTING', reasons };
  }

  if (!inputs.matchType) {
    reasons.push('No deterministic or semantic match found');
    return { level: 'INSUFFICIENT_EVIDENCE', reasons };
  }

  if (inputs.isVerified && (inputs.matchType === 'EXACT_OEM' || inputs.matchType === 'EXACT_INTERNAL_CODE' || inputs.matchType === 'EXACT_TECDOC')) {
    reasons.push(`Exact identifier match (${inputs.matchType}) against a verified canonical record`);
    return { level: 'VERIFIED', reasons };
  }

  if (inputs.matchType === 'EXACT_OEM' || inputs.matchType === 'EXACT_INTERNAL_CODE' || inputs.matchType === 'EXACT_ALTERNATE' || inputs.matchType === 'EXACT_TECDOC') {
    reasons.push(`Exact identifier match (${inputs.matchType})`);
    if (inputs.sourceCount > 1) reasons.push(`Confirmed by ${inputs.sourceCount} independent source references`);
    return { level: 'HIGH', reasons };
  }

  if (inputs.matchType === 'VERIFIED_SUPERSESSION' || inputs.matchType === 'VERIFIED_FITMENT') {
    reasons.push(`Verified relationship (${inputs.matchType})`);
    return { level: 'HIGH', reasons };
  }

  if (inputs.manualReviewPending) {
    reasons.push('A related manual review is still pending');
    return { level: 'LOW', reasons };
  }

  if (inputs.matchType === 'KEYWORD_MATCH' || inputs.matchType === 'SEMANTIC_MATCH') {
    const scoreOk = (inputs.retrievalScore ?? 0) >= 0.65;
    reasons.push(`${inputs.matchType} only, retrieval score ${(inputs.retrievalScore ?? 0).toFixed(2)}`);
    return { level: scoreOk ? 'MEDIUM' : 'LOW', reasons };
  }

  reasons.push('Possible alternative — not independently confirmed');
  return { level: 'LOW', reasons };
}
