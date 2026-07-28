// Pure, DB-free identifier normalization for CATALOGUE SEARCH specifically —
// deliberately separate from src/parts/normalize.ts's normalizeOemNumber(),
// which is matching-critical (used by PartMatcherService/PartConsolidation
// MatchingService to decide real canonical-entity merges) and is left
// completely untouched by this phase. This module exists only to widen what
// a *search query* matches against, never to decide what two records
// canonically ARE. See docs/ai/oem-normalization.md.
//
// The original value is always preserved alongside any normalized variant
// — never discarded — so a caller can always fall back to exact-as-typed
// comparison.
export interface NormalizedIdentifier {
  original: string;
  strict: string; // uppercase, trimmed only — safe for any identifier, never merges distinct numbers
  relaxed: string; // strict + spaces/hyphens/dots/slashes removed — for broader search matching only
  leadingZerosStripped: string; // relaxed + leading zeros removed — ONLY safe for numeric-only codes, opt-in
}

const SEPARATOR_PATTERN = /[\s\-./]/g;

export function normalizeIdentifierForSearch(raw: string): NormalizedIdentifier {
  const original = raw;
  const strict = raw.trim().toUpperCase();
  const relaxed = strict.replace(SEPARATOR_PATTERN, '');
  // Leading-zero stripping is only business-safe for purely numeric codes —
  // stripping a leading zero from an alphanumeric code (e.g. "0A1234")
  // could conflate it with an unrelated code ("A1234" from a different
  // supplier). Only applied when the relaxed form is all-digits.
  const leadingZerosStripped = /^\d+$/.test(relaxed) ? relaxed.replace(/^0+(?=\d)/, '') : relaxed;

  return { original, strict, relaxed, leadingZerosStripped };
}

// Real, documented supplier-prefix stripping — ONLY the prefixes this
// codebase has actually confirmed appear as a real supplier convention (see
// docs/ai/oem-normalization.md for the evidence). Never a generic
// "strip anything that looks like a prefix" heuristic, since that risks
// merging genuinely distinct part numbers from different suppliers.
const DOCUMENTED_SUPPLIER_PREFIXES: string[] = [];

export function stripDocumentedSupplierPrefix(relaxed: string): string {
  for (const prefix of DOCUMENTED_SUPPLIER_PREFIXES) {
    if (relaxed.startsWith(prefix)) return relaxed.slice(prefix.length);
  }
  return relaxed;
}

// Real match check across all three normalization strengths — used by
// CatalogueSearchService so "exact" retrieval still finds a query typed
// with different spacing/casing/punctuation than what's stored, without
// ever silently treating two truly different identifiers as the same one.
export function identifiersMatch(a: string, b: string): { matched: boolean; strength: 'STRICT' | 'RELAXED' | 'NONE' } {
  const normA = normalizeIdentifierForSearch(a);
  const normB = normalizeIdentifierForSearch(b);

  if (normA.strict === normB.strict) return { matched: true, strength: 'STRICT' };
  if (normA.relaxed === normB.relaxed) return { matched: true, strength: 'RELAXED' };
  return { matched: false, strength: 'NONE' };
}
