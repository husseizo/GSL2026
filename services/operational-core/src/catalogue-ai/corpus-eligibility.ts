// Pure eligibility classification for catalogue indexing — no DB, no I/O.
// See docs/ai/catalogue-corpus-contract.md.
export type IndexEligibility = 'INDEX_ELIGIBLE' | 'INDEX_WITH_WARNINGS' | 'MANUAL_REVIEW_REQUIRED' | 'EXCLUDED_CONFLICT' | 'EXCLUDED_LOW_QUALITY' | 'EXCLUDED_MISSING_IDENTITY';

export interface EligibilityInput {
  hasCanonicalId: boolean;
  hasSourceProvenance: boolean;
  hasSearchableContent: boolean;
  hasCriticalIdentityConflict: boolean; // e.g. a real CONFLICTING_CATEGORY OEM-consolidation conflict (see docs/data-readiness/parts-catalogue-quality.md)
  hasMinorConflict: boolean; // e.g. a brand-only difference — expected multi-supplier coverage, not necessarily an error
  accessClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  isActiveOrHistorical: boolean;
}

// Category conflicts (real identity errors) are excluded outright; brand-
// only conflicts (expected multi-supplier aftermarket coverage — see
// docs/data-readiness/decision-log.md) are indexed WITH a visible warning,
// never silently as a clean fact and never silently dropped either.
export function classifyIndexEligibility(input: EligibilityInput): IndexEligibility {
  if (!input.hasCanonicalId) return 'EXCLUDED_MISSING_IDENTITY';
  if (!input.hasSourceProvenance || !input.hasSearchableContent) return 'EXCLUDED_LOW_QUALITY';
  if (!input.isActiveOrHistorical) return 'EXCLUDED_LOW_QUALITY';
  if (input.accessClassification === 'RESTRICTED') return 'EXCLUDED_LOW_QUALITY';

  if (input.hasCriticalIdentityConflict) return 'EXCLUDED_CONFLICT';
  if (input.hasMinorConflict) return 'MANUAL_REVIEW_REQUIRED';

  return 'INDEX_ELIGIBLE';
}

// A conflict-aware review corpus (spec §9: "may be indexed in a conflict-
// aware review corpus where clearly marked") — records classified
// MANUAL_REVIEW_REQUIRED are still real, retrievable, but must always
// surface their conflict rather than being presented as clean.
export function isEligibleForConflictAwareCorpus(eligibility: IndexEligibility): boolean {
  return eligibility === 'INDEX_ELIGIBLE' || eligibility === 'INDEX_WITH_WARNINGS' || eligibility === 'MANUAL_REVIEW_REQUIRED';
}
