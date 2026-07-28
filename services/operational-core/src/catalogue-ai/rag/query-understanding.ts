// Pure, deterministic query-type classification — no LLM call. The spec's
// explicit rule: "Do not send obvious exact identifiers to the LLM before
// deterministic lookup." This is a real heuristic classifier (regex-based),
// not a trained NLU model — honestly scoped to what's achievable without
// labeled training data. See docs/ai/catalogue-rag-architecture.md.
//
// DGX Prototype 1.5 extends this with two safety-relevant categories
// (PROMPT_INJECTION, UNSUPPORTED_DIAGNOSTIC) that must never reach
// generation with a normal evidence-answering prompt — see
// docs/ai-tuning/query-routing.md and docs/ai-tuning/prompt-injection-testing.md.
export type QueryType = 'IDENTIFIER' | 'VIN' | 'VISCOSITY' | 'APPROVAL' | 'PROMPT_INJECTION' | 'UNSUPPORTED_DIAGNOSTIC' | 'DESCRIPTION';

export interface ParsedQuery {
  type: QueryType;
  rawQuery: string;
  candidateIdentifier?: string;
}

// A real OEM/internal/TecDoc code is typically short, alphanumeric, and
// contains at least one digit — this deliberately over-includes (a
// description with a number in it, e.g. "500ml bottle") rather than
// under-includes, since the cost of trying deterministic lookup first and
// finding nothing is low (it just falls through to semantic search), while
// the cost of skipping deterministic lookup for a real identifier query
// would violate the phase's explicit rule.
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s\-./]{2,24}$/;
const HAS_DIGIT = /\d/;
// Exported for reuse by the DGX 1.7.2 Retrieval Intelligence query
// classifier (src/retrieval-intelligence/query-understanding/query-classifier.ts)
// — reused directly rather than re-implemented, per that phase's own
// composition-not-duplication discipline.
export const VISCOSITY_PATTERN = /\b\d{1,2}w-?\d{1,2}\b/i;
export const APPROVAL_PATTERN = /\b(VW|MB|BMW|MERCEDES|VOLKSWAGEN)\s*[\s-]?\d{3,6}(\.\d+)?\b/i;
// Real VIN shape: 17 characters, excludes I/O/Q (never used in real VINs
// to avoid confusion with 1/0). Checked as its own category before the
// generic identifier fallback so a real VIN is never misrouted to the
// (too-permissive for 17 chars) generic identifier pattern's word-count
// limit.
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

// A real OEM/internal/TecDoc code embedded inside a longer sentence (e.g.
// a mixed-language request like "Nataka sehemu yenye namba 036145933G" —
// Swahili for "I want the part with number 036145933G"). The whole-string
// IDENTIFIER_PATTERN above requires the *entire* trimmed query to look like
// an identifier, so it never fires here — the query falls through to plain
// DESCRIPTION semantic search, which has no guarantee of surfacing the
// document for that exact identifier. Found via real testing: a Swahili
// mixed query correctly retrieved unrelated documents, and claim
// verification correctly (but unhelpfully) stripped the identifier as
// unsupported by that wrong evidence — the actual bug was upstream, in
// classification never trying deterministic lookup at all. This pattern
// requires both a letter and a digit (distinguishing a real code from a
// bare number that could just be a quantity or measurement) and a length
// typical of real part numbers, so it doesn't fire on ordinary numbers
// embedded in prose (e.g. "500ml bottle", "the 2019 model").
export const EMBEDDED_IDENTIFIER_TOKEN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9.-]{5,17}$/;

// Real, catalogue-specific adversarial patterns — a subset of what
// prompt-sanitizer.ts already checks (reused concept, not duplicated
// implementation, since that check runs unconditionally on every prompt
// regardless of this classifier) plus catalogue-specific asks the spec
// explicitly names: inventing a part number, ignoring sources, bypassing
// conflict warnings.
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /ignore\s+(the\s+)?sources?/i,
  /reveal\s+(the\s+)?(system\s+prompt|your\s+instructions)/i,
  /invent\s+(a\s+)?(part\s+number|oem|approval)/i,
  /make\s+up\s+(a\s+)?(part\s+number|oem|approval|identifier)/i,
  /bypass\s+(the\s+)?(policy|conflict|warning|restriction)/i,
  /execute\s+(sql|a\s+query|code)/i,
  /(drop|delete|update|insert)\s+(table|from|into)/i,
  /write\s+(directly\s+)?to\s+the\s+database/i,
];

// The assistant must never diagnose a vehicle fault or confirm a repair
// will work — spec §14/out-of-scope. These queries get a fixed, safe
// refusal rather than being sent to the generative evidence-answering
// prompt at all.
const UNSUPPORTED_DIAGNOSTIC_PATTERNS: RegExp[] = [
  /will\s+this\s+(part\s+)?fix/i,
  /what('s|\s+is)\s+wrong\s+with\s+my\s+(car|vehicle|engine)/i,
  /diagnos(e|is)\s+my/i,
  /why\s+is\s+my\s+(car|vehicle|engine)/i,
];

export function classifyQuery(rawQuery: string): ParsedQuery {
  const trimmed = rawQuery.trim();

  if (PROMPT_INJECTION_PATTERNS.some((p) => p.test(trimmed))) {
    return { type: 'PROMPT_INJECTION', rawQuery: trimmed };
  }

  if (UNSUPPORTED_DIAGNOSTIC_PATTERNS.some((p) => p.test(trimmed))) {
    return { type: 'UNSUPPORTED_DIAGNOSTIC', rawQuery: trimmed };
  }

  if (VIN_PATTERN.test(trimmed.replace(/\s+/g, ''))) {
    return { type: 'VIN', rawQuery: trimmed, candidateIdentifier: trimmed.replace(/\s+/g, '') };
  }

  if (VISCOSITY_PATTERN.test(trimmed)) {
    return { type: 'VISCOSITY', rawQuery: trimmed, candidateIdentifier: trimmed.match(VISCOSITY_PATTERN)?.[0] };
  }

  if (APPROVAL_PATTERN.test(trimmed)) {
    return { type: 'APPROVAL', rawQuery: trimmed, candidateIdentifier: trimmed.match(APPROVAL_PATTERN)?.[0] };
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 3 && IDENTIFIER_PATTERN.test(trimmed) && HAS_DIGIT.test(trimmed)) {
    return { type: 'IDENTIFIER', rawQuery: trimmed, candidateIdentifier: trimmed };
  }

  // The whole-string checks above all failed (this isn't purely an
  // identifier, or it's phrased as a longer sentence in any language) — try
  // to pull an identifier-shaped token out of the words, so a real
  // deterministic lookup is still attempted before falling back to semantic
  // search. Prefer the longest candidate token (real OEM/internal codes are
  // rarely the shortest alphanumeric token in a sentence).
  const words = trimmed.split(/\s+/).filter(Boolean);
  const embeddedCandidates = words.filter((w) => EMBEDDED_IDENTIFIER_TOKEN.test(w));
  if (embeddedCandidates.length > 0) {
    const longest = embeddedCandidates.reduce((a, b) => (b.length > a.length ? b : a));
    return { type: 'IDENTIFIER', rawQuery: trimmed, candidateIdentifier: longest };
  }

  return { type: 'DESCRIPTION', rawQuery: trimmed };
}
