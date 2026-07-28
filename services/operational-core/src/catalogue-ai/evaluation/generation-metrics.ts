// Pure generation-quality metrics — no DB, no LLM call. Reuses Phase 4's
// computeGroundingScore() rather than reimplementing lexical-overlap
// hallucination monitoring. See docs/ai/offline-evaluation.md.
import { computeGroundingScore } from '../../rag/grounding-score';

export interface CitationCase {
  citedSourceIds: string[];
  retrievedSourceIds: string[]; // the real sources actually available to cite
}

// Citation correctness: of everything cited, how much was actually a real
// retrieved source (never a fabricated citation).
export function citationCorrectness(cases: CitationCase[]): number {
  if (cases.length === 0) return 1;
  let correctCount = 0;
  let totalCitations = 0;
  for (const c of cases) {
    totalCitations += c.citedSourceIds.length;
    correctCount += c.citedSourceIds.filter((id) => c.retrievedSourceIds.includes(id)).length;
  }
  return totalCitations > 0 ? correctCount / totalCitations : 1;
}

// Citation completeness: of the real retrieved sources that materially
// supported the answer, how many were actually cited (a caller passes only
// the subset of retrievedSourceIds it judges "material" for this metric to
// be meaningful — this function itself doesn't judge materiality).
export function citationCompleteness(cases: { materialSourceIds: string[]; citedSourceIds: string[] }[]): number {
  if (cases.length === 0) return 1;
  let cited = 0;
  let material = 0;
  for (const c of cases) {
    material += c.materialSourceIds.length;
    cited += c.materialSourceIds.filter((id) => c.citedSourceIds.includes(id)).length;
  }
  return material > 0 ? cited / material : 1;
}

export function groundednessScore(answer: string, sourceTexts: string[]): number {
  return computeGroundingScore(answer, sourceTexts);
}

// A cheap, honest proxy for "unsupported technical claim rate": counts
// technical-identifier-shaped tokens (OEM-like alphanumeric codes) in the
// answer that do NOT appear anywhere in the retrieved source text — a
// generated OEM number/approval code that isn't grounded in evidence is
// exactly the kind of invented fact the phase's rules forbid.
const IDENTIFIER_TOKEN_PATTERN = /\b[A-Z0-9]{4,}\b/g;

export function unsupportedTechnicalClaimRate(answer: string, sourceTexts: string[]): number {
  const answerTokens = [...answer.matchAll(IDENTIFIER_TOKEN_PATTERN)].map((m) => m[0]);
  if (answerTokens.length === 0) return 0;
  const sourceText = sourceTexts.join(' ');
  const unsupported = answerTokens.filter((token) => !sourceText.includes(token));
  return unsupported.length / answerTokens.length;
}

// Structured-output validity: does the assembled CatalogueRagAnswer
// actually satisfy the required response shape (spec §17)?
export function isValidStructuredAnswer(answer: Record<string, unknown>): boolean {
  const requiredKeys = ['directAnswer', 'matchingProducts', 'matchBasis', 'verifiedFitment', 'alternatives', 'conflictsOrWarnings', 'sources', 'confidence', 'recommendedNextAction'];
  return requiredKeys.every((key) => key in answer);
}
