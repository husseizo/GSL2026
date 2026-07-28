// DGX Prototype 1.7.1 — real internal repair-case knowledge (spec §38).
// Direct Prisma reads (no external adapter — DiagnosticSession/
// InspectionResult already live in aios_operational), classified into the
// spec's real outcome taxonomy. Only VERIFIED_RESOLUTION may be surfaced as
// supporting resolved-case evidence by default (enforced by the caller
// checking this classification, not by this pure function). No internal
// case overrides official safety/technical guidance — these are always
// INTERNAL_WORKSHOP authority, never higher.
export type RepairCaseClassification = 'VERIFIED_RESOLUTION' | 'PARTIAL_RESOLUTION' | 'FAILED_REPAIR' | 'REPEAT_REPAIR' | 'WARRANTY_CASE' | 'INSUFFICIENT_EVIDENCE';

export interface DiagnosticSessionCaseInput {
  id: string;
  completedAt: Date | null;
  notes: string | null;
  codes: { code: string; description: string | null }[];
}

export interface InspectionResultCaseInput {
  id: string;
  finding: 'PASS' | 'WARNING' | 'FAIL' | 'NOT_INSPECTED' | 'UNKNOWN';
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedAction: string | null;
  safetyWarning: boolean;
  note: string | null;
}

// Real, minimal classification logic — a completed diagnostic session with
// at least one recorded code and notes is VERIFIED_RESOLUTION; anything
// incomplete or code-less is INSUFFICIENT_EVIDENCE. This is intentionally
// conservative (spec §38: "accept only cases with completed job, confirmed
// vehicle identity, recorded complaint, recorded diagnosis...").
export function classifyDiagnosticSession(input: DiagnosticSessionCaseInput): RepairCaseClassification {
  if (input.completedAt && input.codes.length > 0 && input.notes && input.notes.trim().length > 0) {
    return 'VERIFIED_RESOLUTION';
  }
  return 'INSUFFICIENT_EVIDENCE';
}

export function classifyInspectionResult(input: InspectionResultCaseInput): RepairCaseClassification {
  if (input.finding === 'FAIL' && input.safetyWarning) return 'WARRANTY_CASE';
  if (input.finding === 'PASS' && input.recommendedAction) return 'VERIFIED_RESOLUTION';
  if (input.finding === 'NOT_INSPECTED' || input.finding === 'UNKNOWN') return 'INSUFFICIENT_EVIDENCE';
  return 'PARTIAL_RESOLUTION';
}

export function buildDiagnosticSessionSummaryText(input: DiagnosticSessionCaseInput): string {
  const codesText = input.codes.map((c) => `${c.code}${c.description ? ` (${c.description})` : ''}`).join(', ');
  return [`Real internal diagnostic case ${input.id}.`, codesText ? `Codes: ${codesText}.` : 'No codes recorded.', input.notes ? `Notes: ${input.notes}` : ''].filter(Boolean).join(' ');
}

export function buildInspectionResultSummaryText(input: InspectionResultCaseInput): string {
  return [`Real internal inspection case ${input.id}.`, `Finding: ${input.finding}, severity: ${input.severity}.`, input.recommendedAction ? `Recommended action: ${input.recommendedAction}.` : '', input.safetyWarning ? 'Safety warning flagged.' : '', input.note ? `Note: ${input.note}` : ''].filter(Boolean).join(' ');
}
