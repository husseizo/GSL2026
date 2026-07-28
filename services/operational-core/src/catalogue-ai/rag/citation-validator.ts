// Runtime citation validation (DGX Prototype 1.5) — checks a single real
// answer's citations against the real candidates that were actually
// retrieved for that query, at generation time (not an aggregate offline
// metric — see ../evaluation/generation-metrics.ts for the equivalent
// offline-evaluation statistic, which this module's logic mirrors so the
// two never disagree on what "correct" means). See
// docs/ai-tuning/citation-quality.md.
export interface CitationCheckResult {
  correct: boolean;
  missingSourceIds: string[]; // cited but not actually retrieved — the fabricated-citation case
  extraRetrievedNotCited: string[]; // retrieved and included in context but never cited — informational, not necessarily an error
}

export function validateCitations(citedDocumentIds: string[], retrievedDocumentIds: string[]): CitationCheckResult {
  const retrievedSet = new Set(retrievedDocumentIds);
  const missingSourceIds = citedDocumentIds.filter((id) => !retrievedSet.has(id));
  const citedSet = new Set(citedDocumentIds);
  const extraRetrievedNotCited = retrievedDocumentIds.filter((id) => !citedSet.has(id));

  return {
    correct: missingSourceIds.length === 0,
    missingSourceIds,
    extraRetrievedNotCited,
  };
}
