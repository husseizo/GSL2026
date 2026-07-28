// Context construction (DGX Prototype 1.5) — the generative layer must not
// receive one undifferentiated block of retrieved text. Every candidate is
// grouped by real evidence quality (verification status, conflict status)
// into labeled sections, so the LLM (and a human reading the rendered
// prompt) can see which evidence is verified fact vs. an unverified
// candidate before a single word of the answer is generated. See
// docs/ai-tuning/context-optimization.md.
export interface ContextCandidate {
  documentId: string;
  documentTitle: string;
  text: string;
  score: number;
  sourceType: string;
  confidence: number;
  isApproved: boolean;
  hasConflict: boolean;
}

export interface BuiltContext {
  renderedText: string;
  sectionCounts: Record<string, number>;
  includedDocumentIds: string[];
  excludedDocumentIds: string[];
}

// Real ranking rule carried over from hybrid-ranking.ts's discipline: a
// candidate with a live-detected conflict is never placed in the same
// section as a verified fact, regardless of its retrieval score.
function classifySection(candidate: ContextCandidate): 'VERIFIED_FACTS' | 'CONFLICT_EVIDENCE' | 'LUBRICANT_APPROVAL_EVIDENCE' | 'CANDIDATE_MATCHES' {
  if (candidate.hasConflict) return 'CONFLICT_EVIDENCE';
  if (candidate.sourceType === 'LUBRICANT_DOCUMENTATION') return 'LUBRICANT_APPROVAL_EVIDENCE';
  if (candidate.isApproved && candidate.confidence >= 0.9) return 'VERIFIED_FACTS';
  return 'CANDIDATE_MATCHES';
}

const SECTION_ORDER = ['VERIFIED_FACTS', 'LUBRICANT_APPROVAL_EVIDENCE', 'CANDIDATE_MATCHES', 'CONFLICT_EVIDENCE'] as const;
const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  VERIFIED_FACTS: 'Verified facts (approved, high-confidence catalogue records)',
  LUBRICANT_APPROVAL_EVIDENCE: 'Lubricant evidence (viscosity/API/ACEA/approval fields are parsed and unverified unless the record states otherwise)',
  CANDIDATE_MATCHES: 'Candidate matches (retrieved but not independently verified — do not present as confirmed)',
  CONFLICT_EVIDENCE: 'Conflicting evidence (source records disagree — never present as a clean verified match)',
};

// Context minimization: takes the full candidate list (already ranked by
// retrieval score) and keeps only the top N — smaller context sizes are
// evaluated empirically (see docs/ai-tuning/context-optimization.md's
// context-size sweep), since more context is not automatically better for
// groundedness.
export function buildContext(candidates: ContextCandidate[], maxCandidates: number): BuiltContext {
  const included = candidates.slice(0, maxCandidates);
  const excluded = candidates.slice(maxCandidates);

  const bySection = new Map<string, ContextCandidate[]>();
  for (const candidate of included) {
    const section = classifySection(candidate);
    const list = bySection.get(section) ?? [];
    list.push(candidate);
    bySection.set(section, list);
  }

  const parts: string[] = [];
  const sectionCounts: Record<string, number> = {};
  for (const section of SECTION_ORDER) {
    const items = bySection.get(section);
    sectionCounts[section] = items?.length ?? 0;
    if (!items || items.length === 0) continue;
    parts.push(`## ${SECTION_LABELS[section]}`);
    for (const item of items) {
      parts.push(`[${item.documentId}] (${item.documentTitle}): ${item.text}`);
    }
  }

  if (included.length === 0) {
    parts.push('## Missing information');
    parts.push('No catalogue evidence was retrieved for this query.');
  }

  return {
    renderedText: parts.join('\n\n'),
    sectionCounts,
    includedDocumentIds: included.map((c) => c.documentId),
    excludedDocumentIds: excluded.map((c) => c.documentId),
  };
}
