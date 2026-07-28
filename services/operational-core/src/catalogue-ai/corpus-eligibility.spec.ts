import { classifyIndexEligibility, isEligibleForConflictAwareCorpus } from './corpus-eligibility';

const baseInput = {
  hasCanonicalId: true,
  hasSourceProvenance: true,
  hasSearchableContent: true,
  hasCriticalIdentityConflict: false,
  hasMinorConflict: false,
  accessClassification: 'INTERNAL' as const,
  isActiveOrHistorical: true,
};

describe('classifyIndexEligibility', () => {
  it('excludes records with no stable canonical identity first, before any other check', () => {
    expect(classifyIndexEligibility({ ...baseInput, hasCanonicalId: false, hasCriticalIdentityConflict: true })).toBe('EXCLUDED_MISSING_IDENTITY');
  });

  it('excludes records with no source provenance', () => {
    expect(classifyIndexEligibility({ ...baseInput, hasSourceProvenance: false })).toBe('EXCLUDED_LOW_QUALITY');
  });

  it('excludes records with no searchable content', () => {
    expect(classifyIndexEligibility({ ...baseInput, hasSearchableContent: false })).toBe('EXCLUDED_LOW_QUALITY');
  });

  it('excludes inactive/non-historical records', () => {
    expect(classifyIndexEligibility({ ...baseInput, isActiveOrHistorical: false })).toBe('EXCLUDED_LOW_QUALITY');
  });

  it('excludes RESTRICTED-access records from the general index', () => {
    expect(classifyIndexEligibility({ ...baseInput, accessClassification: 'RESTRICTED' })).toBe('EXCLUDED_LOW_QUALITY');
  });

  it('excludes a real category conflict outright (a genuine identity error)', () => {
    expect(classifyIndexEligibility({ ...baseInput, hasCriticalIdentityConflict: true })).toBe('EXCLUDED_CONFLICT');
  });

  it('routes a brand-only conflict to manual review rather than excluding or silently indexing it', () => {
    expect(classifyIndexEligibility({ ...baseInput, hasMinorConflict: true })).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('is INDEX_ELIGIBLE when every requirement is met and there is no conflict', () => {
    expect(classifyIndexEligibility(baseInput)).toBe('INDEX_ELIGIBLE');
  });
});

describe('isEligibleForConflictAwareCorpus', () => {
  it('includes MANUAL_REVIEW_REQUIRED records (clearly marked, not excluded)', () => {
    expect(isEligibleForConflictAwareCorpus('MANUAL_REVIEW_REQUIRED')).toBe(true);
  });

  it('excludes records classified as EXCLUDED_CONFLICT', () => {
    expect(isEligibleForConflictAwareCorpus('EXCLUDED_CONFLICT')).toBe(false);
  });

  it('excludes records classified as EXCLUDED_MISSING_IDENTITY', () => {
    expect(isEligibleForConflictAwareCorpus('EXCLUDED_MISSING_IDENTITY')).toBe(false);
  });
});
