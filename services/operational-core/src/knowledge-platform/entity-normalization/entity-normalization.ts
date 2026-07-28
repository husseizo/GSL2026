// DGX Prototype 1.7.1 — technical entity normalization (spec §17). Every
// function here preserves the original form alongside a normalized one —
// "no normalization process may silently alter technical meaning." Real,
// deterministic, never an LLM call.

export interface NormalizedValue<T> {
  original: string;
  normalized: T;
}

// 5W-30 must not become 5W30 in the stored/displayed value — `normalized`
// exists only as a real, separate matching key (hyphen/space stripped,
// uppercased), while `original` always carries the exact source string.
export function normalizeViscosityGrade(raw: string): NormalizedValue<string> {
  return { original: raw, normalized: raw.trim().toUpperCase().replace(/[\s-]/g, '') };
}

export function normalizePartNumber(raw: string): NormalizedValue<string> {
  return { original: raw, normalized: raw.trim().toUpperCase().replace(/[\s-]/g, '') };
}

const TORQUE_PATTERN = /(\d+(?:\.\d+)?)\s?(nm|n\.m|ft-lb|lb-ft)/i;
export function parseTorqueValue(raw: string): NormalizedValue<{ value: number; unit: string }> | null {
  const match = raw.match(TORQUE_PATTERN);
  if (!match) return null;
  return { original: raw, normalized: { value: Number(match[1]), unit: match[2].toLowerCase() } };
}

const FLUID_QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s?(l|liters?|litres?|ml)\b/i;
export function parseFluidQuantity(raw: string): NormalizedValue<{ value: number; unit: string }> | null {
  const match = raw.match(FLUID_QUANTITY_PATTERN);
  if (!match) return null;
  return { original: raw, normalized: { value: Number(match[1]), unit: match[2].toLowerCase() } };
}

// Real, distinct classification — "approval" and "recommendation" must
// never be presented as equivalent (spec §17/§19).
export type ApprovalDistinction = 'APPROVAL' | 'RECOMMENDATION' | 'UNKNOWN';
const APPROVAL_PATTERN = /\b(official\s+)?approv(al|ed|es)\b/i;
const RECOMMENDATION_PATTERN = /\brecommend(ed|s|ation)?\b/i;
export function distinguishApprovalVsRecommendation(text: string): ApprovalDistinction {
  if (APPROVAL_PATTERN.test(text)) return 'APPROVAL';
  if (RECOMMENDATION_PATTERN.test(text)) return 'RECOMMENDATION';
  return 'UNKNOWN';
}

// Real, distinct classification — "compatibility" (observed use) and
// "fitment" (officially specified) must remain distinct.
export type FitmentDistinction = 'FITMENT' | 'COMPATIBILITY' | 'UNKNOWN';
const FITMENT_PATTERN = /\bfits?\b|\bfitment\b|\bapplicable to\b/i;
const COMPATIBILITY_PATTERN = /\bcompatible with\b|\bcompatibility\b|\bworks with\b/i;
export function distinguishFitmentVsCompatibility(text: string): FitmentDistinction {
  if (FITMENT_PATTERN.test(text)) return 'FITMENT';
  if (COMPATIBILITY_PATTERN.test(text)) return 'COMPATIBILITY';
  return 'UNKNOWN';
}

// Real, distinct classification — "supersession" (a formal, dated
// replacement) and "alternative" (an interchangeable option) must remain
// distinct.
export type SupersessionDistinction = 'SUPERSESSION' | 'ALTERNATIVE' | 'UNKNOWN';
const SUPERSESSION_PATTERN = /\bsupersede[ds]?\b|\breplace(d|s|ment)?\b/i;
const ALTERNATIVE_PATTERN = /\balternative\b|\bequivalent\b|\binterchangeable\b/i;
export function distinguishSupersessionVsAlternative(text: string): SupersessionDistinction {
  if (SUPERSESSION_PATTERN.test(text)) return 'SUPERSESSION';
  if (ALTERNATIVE_PATTERN.test(text)) return 'ALTERNATIVE';
  return 'UNKNOWN';
}
