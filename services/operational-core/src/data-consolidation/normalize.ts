// Pure normalization helpers for cross-source matching. No DB, no I/O —
// deterministic string transforms only, so matching decisions are testable
// in isolation. See docs/data-consolidation/customer-consolidation.md.

// Real samples from MolasCacheDb show phones like "+255712345678" alongside
// blank strings — strip everything but leading "+" and digits so
// "+255 712 345 678" and "+255712345678" compare equal.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const digits = trimmed.replace(/[^\d+]/g, '');
  return digits.length > 0 ? digits : null;
}

// Lowercases, strips common legal-entity suffixes and punctuation, collapses
// whitespace — enough to compare "ABC Motors Ltd." against "abc motors
// limited" without a full fuzzy-matching library.
export function normalizeCompanyName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(ltd|limited|llc|inc|co|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTaxNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\dA-Za-z]/g, '').toUpperCase();
  return digits.length > 0 ? digits : null;
}

// Real data shows generic/walk-in codes ("0001", "0000000") reused across
// many unrelated real customers — these must never be treated as a real
// party identity signal. See docs/data-sources/source-data-risks.md §5.
const GENERIC_CUSTOMER_CODES = new Set(['0001', '00000000', 'b00000000', 'c00000000', 'cash', 'walkin']);

export function isGenericCustomerCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return GENERIC_CUSTOMER_CODES.has(code.trim().toLowerCase());
}
