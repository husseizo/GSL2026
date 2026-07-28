// Deterministic normalization used both when a part is created and when the
// matching pipeline compares parts. Kept as pure functions so the matching
// service and the create path can never drift out of sync with each other.

export function normalizeOemNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_.]/g, '');
}

const FILLER_WORDS = new Set(['the', 'a', 'an', 'for', 'of', 'and', 'oem', 'genuine']);

// Cleans and de-fillers a raw product name while preserving word order, so it
// stays readable for display/search. Used for both storage and as the input
// to the similarity scorer (which does its own tokenization for comparison).
export function standardizeProductName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !FILLER_WORDS.has(token));
  return tokens.join(' ');
}
