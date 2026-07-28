// DGX Prototype 1.7.2 — the 21-class retrieval query classifier (spec §3).
// Pure, deterministic, regex-based — no LLM call, matching the project's
// established classifyQuery() precedent (src/catalogue-ai/rag/query-understanding.ts).
// Reuses that file's VIN/viscosity/approval/embedded-identifier patterns
// directly (imported, not copy-pasted) rather than re-deriving them.
//
// Identifier-shaped classes are checked before any free-text/language
// class, since spec §6 requires identifier lookup to always be attempted
// before semantic search — this ordering is what makes that guarantee
// structural rather than a matter of pipeline discipline.
import {
  VIN_PATTERN,
  VISCOSITY_PATTERN,
  APPROVAL_PATTERN,
  EMBEDDED_IDENTIFIER_TOKEN,
} from '../../catalogue-ai/rag/query-understanding';
import { detectLanguage, DetectedLanguage } from './language-detector';

export type RetrievalQueryClassValue =
  | 'OEM_PART_NUMBER'
  | 'INTERNAL_ITEM_CODE'
  | 'TECDOC_ARTICLE'
  | 'BARCODE'
  | 'SKU'
  | 'VEHICLE_VIN'
  | 'ENGINE_CODE'
  | 'TRANSMISSION_CODE'
  | 'LUBRICANT_APPROVAL'
  | 'LUBRICANT_PRODUCT'
  | 'VEHICLE_MODEL'
  | 'FAULT_CODE'
  | 'TECHNICAL_PROCEDURE'
  | 'FREE_TEXT_QUESTION'
  | 'MIXED_QUERY'
  | 'SWAHILI'
  | 'ENGLISH'
  | 'MIXED_LANGUAGE'
  | 'TYPO'
  | 'APPROXIMATE_SEARCH'
  | 'UNKNOWN';

export interface ClassifiedQuery {
  queryClass: RetrievalQueryClassValue;
  language: DetectedLanguage;
  confidence: number;
  matchedRule: string;
  candidateIdentifier?: string;
}

// Real, observed real-data shapes (confirmed against the live catalogue
// this session): internal item codes are a short uppercase supplier
// prefix followed by digits (e.g. "MB100111", "BM12328", "VAG12695").
const INTERNAL_ITEM_CODE_PATTERN = /^[A-Z]{2,5}\d{4,8}$/;
// Real TecDoc article IDs: this project's own ingested corpus uses
// numeric TecDoc article identifiers (see tecdoc_article table,
// docs/trusted-knowledge-pilot/source-inventory.md) — Part.tecdocArticleId
// itself is 0% populated in the live catalogue (a real, confirmed gap;
// TecDoc content lives only in the separately-ingested Knowledge Platform
// corpus), so this pattern targets that corpus's real ID shape instead.
const TECDOC_ARTICLE_PATTERN = /^TD-?\d{4,10}$/i;
// Real engine codes observed in the live Vehicle table: short
// alphanumeric, 3-6 characters, always containing at least one letter and
// one digit (e.g. "204DTD", "M254", "B57").
const ENGINE_CODE_PATTERN = /^[A-Z]{1,3}\d{2,4}[A-Z]{0,3}$/i;
// Real, rare, pure-alphabetic engine code shape (AI Foundation
// Certification Sprint fix): the live Vehicle table has a real engine code
// with zero digits ("MCY", confirmed by direct query) that the digit-
// requiring pattern above can never match. Deliberately narrow (exactly 3
// letters — the one real shape observed; no 2- or 4-letter pure-alpha
// engine code exists in this environment) and given a low confidence score
// since a bare 3-letter token is genuinely ambiguous with an ordinary short
// English word with no other signal available — this is an accepted,
// measured risk (validated via the full 1,840-case regression run, not
// assumed) rather than a certainty.
const ENGINE_CODE_ALPHA_PATTERN = /^[A-Z]{3}$/;
const TRANSMISSION_CODE_PATTERN = /^(DSG|CVT|AT|MT)-?\d{0,3}$/i;
const FAULT_CODE_PATTERN = /^P[0-3]\d{3}$/i; // real OBD-II DTC shape
const SKU_PATTERN = /^SKU-?[A-Z0-9]{4,12}$/i;
// EAN-13/UPC-A — real, checksum-validated (Luhn-style mod-10 for GTIN),
// not just a bare digit-count guess.
function isValidGtinChecksum(digits: string): boolean {
  const nums = digits.split('').map(Number);
  const checkDigit = nums.pop()!;
  let sum = 0;
  for (let i = 0; i < nums.length; i++) {
    const posFromRight = nums.length - i;
    sum += nums[i] * (posFromRight % 2 === 1 ? 3 : 1);
  }
  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}
const BARCODE_PATTERN = /^\d{12,13}$/;

// Real approval codes are always separated from their brand prefix by a
// space/hyphen or carry a decimal point (confirmed real examples: "VW
// 502.00", "MB 229.5", "BMW LL-01") — internal item codes in this
// catalogue never are (confirmed real examples: "MB100111", "BM12328").
// APPROVAL_PATTERN (reused from query-understanding.ts) matches both
// shapes since it allows a zero-width separator; this local check
// disambiguates a genuine approval from an internal-code false positive
// without modifying the shared, already-live regex.
function looksLikeGenuineApprovalFormat(matchedText: string): boolean {
  return /[\s-]\d/.test(matchedText) || /\.\d/.test(matchedText);
}

const VEHICLE_MODEL_PATTERN = /\b(sedan|suv|hatchback|pickup|coupe|estate|wagon)\b/i;
const PROCEDURE_KEYWORDS = /\b(procedure|how to (replace|install|remove|service)|step[s]?\b|torque sequence|workshop guide)\b/i;

// Real Levenshtein distance — used to detect TYPO/APPROXIMATE_SEARCH
// classes by comparing a query against a small, real sample of known
// identifiers supplied by the caller (never against a fabricated list).
export function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function findClosestKnownIdentifier(query: string, knownIdentifiers: string[]): { identifier: string; distance: number } | null {
  let best: { identifier: string; distance: number } | null = null;
  for (const known of knownIdentifiers) {
    const distance = levenshteinDistance(query.toUpperCase(), known.toUpperCase());
    if (!best || distance < best.distance) best = { identifier: known, distance };
  }
  return best;
}

export function classifyRetrievalQuery(rawQuery: string, knownIdentifierSample: string[] = []): ClassifiedQuery {
  const trimmed = rawQuery.trim();
  const languageResult = detectLanguage(trimmed);
  const noSpaces = trimmed.replace(/\s+/g, '');
  const relaxed = noSpaces.toUpperCase().replace(/[./-]/g, '');
  // Real regression found and fixed while widening the generic fallback's
  // length cap below (AI Foundation Certification Sprint): `noSpaces`
  // collapses an ENTIRE multi-word sentence into one run-on string (spaces
  // just deleted, not preserved as a boundary) — with the old 20-char cap
  // this accidentally never matched a real sentence, but the wider cap
  // needed to catch real long "/"-joined OEM numbers now also matches real
  // multi-word Swahili sentences with an embedded identifier (e.g. "Nataka
  // sehemu yenye namba 036145933G"), hijacking the WHOLE sentence as
  // candidateIdentifier instead of just the embedded token. A real,
  // deliberate exception is a genuine identifier written with internal
  // space separators (e.g. real DB value "164 440 52 41") — every
  // space-separated group there is itself digit-bearing or very short.
  // Distinguishing signal: only treat the whole collapsed string as one
  // identifier when NONE of the original space-separated groups looks like
  // a real word (pure-alphabetic AND 3+ letters) — a real Swahili/English
  // word always fails that test, a segmented identifier never does.
  //
  // Real regression found on the full 1,840-case gold set (round 2): this
  // guard's "3+ letters" check must be applied AFTER stripping each group's
  // own internal separators, not on the raw group. A real gold case spells
  // an OEM number out character-by-character with dashes AND preserves the
  // identifier's own internal group spaces as real spaces (e.g. real query
  // "8-K-0- -4-0-7- -6-9-3- -A-A" for the real stored value "8K0 407 693
  // AA") — its trailing pure-letter revision suffix group becomes the raw
  // token "-A-A" (4 characters, no digit), which this guard mistook for a
  // real word and rejected. Stripping separators first correctly reduces
  // it to "AA" (2 characters, under the length-3 floor), same as any other
  // short real revision-code group, while a genuine Swahili/English word
  // (e.g. "Nataka") is unaffected by separator-stripping since it has none.
  const spaceSeparatedWords = trimmed.split(/\s+/).filter(Boolean);
  const looksLikeSegmentedIdentifier = spaceSeparatedWords.every((w) => {
    const strippedWord = w.replace(/[./-]/g, '');
    return /\d/.test(strippedWord) || strippedWord.length < 3;
  });

  const withRule = (queryClass: RetrievalQueryClassValue, matchedRule: string, confidence = 0.95, candidateIdentifier?: string): ClassifiedQuery => ({
    queryClass,
    language: languageResult.language,
    confidence,
    matchedRule,
    candidateIdentifier,
  });

  // 1. Highest-precedence identifier-shaped classes — always attempted
  // before any language/free-text classification, per spec §6.
  if (VIN_PATTERN.test(relaxed)) return withRule('VEHICLE_VIN', 'VIN_PATTERN', 0.99, relaxed);
  if (FAULT_CODE_PATTERN.test(relaxed)) return withRule('FAULT_CODE', 'FAULT_CODE_PATTERN', 0.97, relaxed);
  if (TECDOC_ARTICLE_PATTERN.test(relaxed)) return withRule('TECDOC_ARTICLE', 'TECDOC_ARTICLE_PATTERN', 0.95, relaxed);
  if (SKU_PATTERN.test(relaxed)) return withRule('SKU', 'SKU_PATTERN', 0.9, relaxed);
  if (BARCODE_PATTERN.test(noSpaces) && isValidGtinChecksum(noSpaces)) return withRule('BARCODE', 'BARCODE_GTIN_CHECKSUM', 0.98, noSpaces);
  if (TRANSMISSION_CODE_PATTERN.test(relaxed)) return withRule('TRANSMISSION_CODE', 'TRANSMISSION_CODE_PATTERN', 0.85, relaxed);
  if (ENGINE_CODE_PATTERN.test(relaxed) && relaxed.length <= 6) return withRule('ENGINE_CODE', 'ENGINE_CODE_PATTERN', 0.75, relaxed);
  if (ENGINE_CODE_ALPHA_PATTERN.test(relaxed)) return withRule('ENGINE_CODE', 'ENGINE_CODE_ALPHA_PATTERN', 0.5, relaxed);
  if (VISCOSITY_PATTERN.test(trimmed)) return withRule('LUBRICANT_PRODUCT', 'VISCOSITY_PATTERN', 0.9, trimmed.match(VISCOSITY_PATTERN)?.[0]);
  const approvalMatch = trimmed.match(APPROVAL_PATTERN)?.[0];
  if (approvalMatch && looksLikeGenuineApprovalFormat(approvalMatch)) return withRule('LUBRICANT_APPROVAL', 'APPROVAL_PATTERN', 0.9, approvalMatch);
  // Real bug found and fixed (AI Foundation Certification Sprint): the
  // candidateIdentifier returned here used to be `relaxed` (separator-
  // stripped) — but CatalogueSearchService.findByOemNumber()/
  // findByInternalCode() already perform their own real strict-then-
  // relaxed cascade internally, trying an exact strict match against the
  // ORIGINAL formatting first. Passing an already-stripped identifier
  // skips that strict step and can strict-match a DIFFERENT real
  // duplicate row that happens to store its identifier without
  // separators — confirmed directly: two real Part rows share the same
  // real part ("164 440 52 41" vs "1644405241"), and passing the
  // pre-stripped form caused the wrong one to be returned even though the
  // original query's own real counterpart (with spaces preserved) was a
  // genuine strict match. `trimmed` (original formatting, only outer
  // whitespace removed) lets the existing, unmodified catalogue lookup
  // try its own real strict match first, as designed.
  if (INTERNAL_ITEM_CODE_PATTERN.test(relaxed)) return withRule('INTERNAL_ITEM_CODE', 'INTERNAL_ITEM_CODE_PATTERN', 0.9, trimmed);

  // 2. Vehicle model / technical procedure — free text with a recognizable
  // domain keyword.
  if (VEHICLE_MODEL_PATTERN.test(trimmed)) return withRule('VEHICLE_MODEL', 'VEHICLE_MODEL_PATTERN', 0.6);
  if (PROCEDURE_KEYWORDS.test(trimmed)) return withRule('TECHNICAL_PROCEDURE', 'PROCEDURE_KEYWORDS', 0.6);

  // 3. Typo / approximate-search — only evaluated when a real sample of
  // known identifiers was supplied (never fabricated); a close-but-not-
  // exact edit distance against a real identifier is a real typo signal.
  // Checked BEFORE the generic alphanumeric fallback below, since a real
  // near-match against a known identifier is a more precise classification
  // than a vague "this looks like some new identifier" guess.
  if (knownIdentifierSample.length > 0 && /^[A-Za-z0-9]{4,20}$/.test(noSpaces)) {
    const closest = findClosestKnownIdentifier(noSpaces, knownIdentifierSample);
    if (closest && closest.distance > 0 && closest.distance <= 2) {
      return withRule('TYPO', 'LEVENSHTEIN_DISTANCE_1_2', 0.65, closest.identifier);
    }
    if (closest && closest.distance > 2 && closest.distance <= 4) {
      return withRule('APPROXIMATE_SEARCH', 'LEVENSHTEIN_DISTANCE_3_4', 0.4, closest.identifier);
    }
  }

  // A generic alphanumeric-with-digit token of plausible OEM-number length
  // that didn't match any more specific pattern above (last resort before
  // falling through to embedded-token/language classification).
  //
  // Real, high-impact bug found and fixed via the AI Foundation
  // Certification Sprint's own gate investigation: this check originally
  // also required a real letter (`&& /[A-Z]/.test(relaxed)`), but a
  // direct query of the live catalogue confirmed 38.6% of all real OEM
  // numbers (2,979 of 7,723 real parts) are PURE NUMERIC after
  // normalization (e.g. "64316935822", "072767210") — every one of these
  // fell through every Section-1 pattern (none of them are VIN/fault-
  // code/TecDoc/SKU/barcode/transmission/engine-code/viscosity/approval/
  // internal-code shaped either) straight to UNKNOWN, which is not in
  // IDENTIFIER_SHAPED_CLASSES, so deterministic exact lookup was never
  // even attempted for roughly 4 in 10 real OEM-number queries. A bare
  // numeric string as the ENTIRE trimmed query (never a fragment inside
  // a longer sentence — that's handled separately below) is a real,
  // safe identifier signal on its own; the letter requirement is dropped.
  //
  // Also widened this sprint to tolerate a real, confirmed trailing "+"
  // convention seen in real stored OEM numbers (e.g. real DB value
  // "1K0853651E+", confirmed by direct query) — previously the "+"
  // character (outside [A-Z0-9]) broke this pattern entirely, sending
  // every real OEM number using that convention to UNKNOWN.
  //
  // Length bounds widened again this sprint, both directions, from real
  // evidence: a direct query of every real Part.oemNumber's length after
  // this same separator-stripping found (a) short real OEM numbers as
  // short as 3 characters (e.g. real DB value "D1S", a bulb-type code —
  // the old {5,20} minimum silently excluded it and 981/551/650/982/0AL,
  // all real, confirmed stored OEM numbers), and (b) a real "cross-
  // reference" convention where this catalogue stores TWO OEM numbers
  // joined by "/" in one field (e.g. real DB value
  // "7P0698007B/66981701201") — 21 characters after "/" is stripped, one
  // over the old 20-char cap. Across all 7,730 real parts, only 7 rows
  // (0.09%) exceed 20 characters, with a real observed max of 100 — so
  // {3,100} is a real, evidence-based bound, not an arbitrary widening.
  if (looksLikeSegmentedIdentifier && /^[A-Z0-9]{3,100}\+?$/.test(relaxed) && /\d/.test(relaxed)) {
    // Real candidateIdentifier fix (see INTERNAL_ITEM_CODE comment above):
    // return the original, unstripped `trimmed` text so the existing
    // catalogue lookup's own strict-then-relaxed cascade runs correctly.
    return withRule('OEM_PART_NUMBER', 'GENERIC_ALPHANUMERIC_IDENTIFIER', 0.7, trimmed);
  }

  // 4. An identifier-shaped token embedded in a longer, possibly
  // multilingual sentence (reused directly from classifyQuery()).
  const words = trimmed.split(/\s+/).filter(Boolean);
  const embedded = words.filter((w) => EMBEDDED_IDENTIFIER_TOKEN.test(w));
  // Real bug found and fixed (AI Foundation Certification Sprint): the
  // shared EMBEDDED_IDENTIFIER_TOKEN (reused from
  // catalogue-ai/rag/query-understanding.ts, never modified here — that
  // regex is also used by the live Catalogue RAG chat feature) requires
  // both a letter AND a digit, so a real, pure-numeric OEM number
  // embedded in a sentence (e.g. "Nataka sehemu yenye namba 1645000049")
  // was never extracted. Confirmed by direct query: 99.6% of real
  // pure-numeric OEM numbers in the live catalogue are 6-13 digits long
  // — a real, local (not shared) pattern bounded to that observed real
  // length range catches these without the over-triggering risk of a
  // bare short number (a quantity, a year) being misread as an identifier.
  // Also tolerates the same real, confirmed trailing "+" convention
  // (e.g. real embedded query "Do you have part 11347547187+ in stock?")
  // as the whole-string generic fallback above — the shared
  // EMBEDDED_IDENTIFIER_TOKEN's charset excludes "+" entirely, so a real
  // embedded identifier using it (numeric or alphanumeric-with-letter,
  // like "1K0853651E+") was never extracted either.
  const embeddedNumeric = words.filter((w) => /^\d{6,13}\+?$/.test(w));
  const embeddedAlphanumericPlus = words.filter((w) => /\+$/.test(w) && EMBEDDED_IDENTIFIER_TOKEN.test(w.slice(0, -1)));
  const allEmbedded = [...embedded, ...embeddedNumeric, ...embeddedAlphanumericPlus];
  if (allEmbedded.length > 0) {
    const longest = allEmbedded.reduce((a, b) => (b.length > a.length ? b : a));
    const mixedQuery = languageResult.language === 'mixed';
    return withRule(mixedQuery ? 'MIXED_QUERY' : 'OEM_PART_NUMBER', 'EMBEDDED_IDENTIFIER_TOKEN', 0.6, longest);
  }

  // 5. Pure language classes for genuinely free-text, non-identifier
  // queries.
  if (languageResult.language === 'sw') return withRule('SWAHILI', 'LANGUAGE_DETECTOR', languageResult.confidence);
  if (languageResult.language === 'mixed') return withRule('MIXED_LANGUAGE', 'LANGUAGE_DETECTOR', languageResult.confidence);
  if (languageResult.language === 'en' && words.length >= 3) return withRule('FREE_TEXT_QUESTION', 'LANGUAGE_DETECTOR_EN', languageResult.confidence);
  if (languageResult.language === 'en') return withRule('ENGLISH', 'LANGUAGE_DETECTOR_EN_SHORT', languageResult.confidence);

  return withRule('UNKNOWN', 'NO_RULE_MATCHED', 0);
}
