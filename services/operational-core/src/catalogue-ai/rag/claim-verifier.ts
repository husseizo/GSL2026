// Real, rule-based claim-level verification (DGX Prototype 1.5) — not a
// formal NLI/entailment model (none is locally available in this
// environment; see docs/ai-tuning/claim-verification.md for that honest
// limitation), but a genuine post-generation check that directly targets
// the exact failure mode the offline evaluation harness measures:
// identifier-shaped tokens (OEM numbers, part codes) appearing in a
// generated answer that are NOT present anywhere in the real retrieved
// evidence — the strongest, most checkable signal of a fabricated
// technical claim available without a bigger model. Spec's own rule: "Do
// not merely score unsupported claims and still display them" — this
// module removes them from the returned answer, it does not just report a
// number.
export type ClaimStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'CONFLICTING' | 'NOT_VERIFIABLE';

export interface VerifiedClaim {
  text: string;
  status: ClaimStatus;
  reasons: string[];
}

export interface ClaimVerificationResult {
  claims: VerifiedClaim[];
  cleanedAnswer: string;
  removedCount: number;
  allRemoved: boolean;
}

const IDENTIFIER_TOKEN_PATTERN = /\b[A-Z0-9][A-Z0-9-]{3,}\b/g;
const SENTENCE_SPLIT_PATTERN = /(?<=[.!?])\s+(?=[A-Z0-9])/;

// Sentence-level lexical overlap — same family of signal as
// grounding-score.ts's computeGroundingScore(), applied per-sentence
// instead of to the whole answer, so a single fabricated sentence can be
// identified and removed without discarding an otherwise-grounded answer.
function lexicalOverlap(sentence: string, evidenceText: string): number {
  const sentenceWords = new Set(sentence.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  if (sentenceWords.size === 0) return 1;
  const evidenceWords = new Set(evidenceText.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  let overlap = 0;
  for (const word of sentenceWords) {
    if (evidenceWords.has(word)) overlap += 1;
  }
  return overlap / sentenceWords.size;
}

function extractIdentifierTokens(text: string): string[] {
  return [...text.matchAll(IDENTIFIER_TOKEN_PATTERN)].map((m) => m[0]);
}

const NOT_VERIFIABLE_OVERLAP_THRESHOLD = 0.35;
const PARTIAL_OVERLAP_THRESHOLD = 0.6;

// Verifies and cleans a generated answer against the real evidence text it
// was supposedly grounded in. Never invents a verdict for an empty answer;
// never silently keeps a sentence naming an identifier absent from
// evidence.
export function verifyAndCleanClaims(answerText: string, evidenceText: string): ClaimVerificationResult {
  const sentences = answerText
    .split(SENTENCE_SPLIT_PATTERN)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return { claims: [], cleanedAnswer: answerText, removedCount: 0, allRemoved: false };
  }

  const claims: VerifiedClaim[] = [];
  const keptSentences: string[] = [];

  for (const sentence of sentences) {
    const identifierTokens = extractIdentifierTokens(sentence);
    const unsupportedTokens = identifierTokens.filter((t) => !evidenceText.includes(t));

    if (unsupportedTokens.length > 0) {
      claims.push({ text: sentence, status: 'UNSUPPORTED', reasons: [`References identifier(s) not found in retrieved evidence: ${unsupportedTokens.join(', ')}`] });
      continue; // removed from cleanedAnswer
    }

    if (identifierTokens.length > 0) {
      // Every identifier token in this sentence was verified against the
      // real evidence text above — that is a strong, specific positive
      // signal on its own. A short sentence like "The part is X." will
      // otherwise score low on generic word overlap (mostly stopwords)
      // even though its one concrete claim is fully grounded; the
      // lexical-overlap fallback below is for identifier-free prose only.
      claims.push({ text: sentence, status: 'SUPPORTED', reasons: [`All identifier(s) verified against evidence: ${identifierTokens.join(', ')}`] });
      keptSentences.push(sentence);
      continue;
    }

    const overlap = lexicalOverlap(sentence, evidenceText);
    if (overlap >= PARTIAL_OVERLAP_THRESHOLD) {
      claims.push({ text: sentence, status: 'SUPPORTED', reasons: [`Lexical overlap with evidence: ${overlap.toFixed(2)}`] });
      keptSentences.push(sentence);
    } else if (overlap >= NOT_VERIFIABLE_OVERLAP_THRESHOLD) {
      claims.push({ text: sentence, status: 'PARTIALLY_SUPPORTED', reasons: [`Moderate lexical overlap with evidence: ${overlap.toFixed(2)}`] });
      keptSentences.push(sentence);
    } else {
      claims.push({ text: sentence, status: 'NOT_VERIFIABLE', reasons: [`Low lexical overlap with evidence: ${overlap.toFixed(2)} — likely commentary/transition text, not a specific factual claim`] });
      keptSentences.push(sentence); // kept: removing every low-overlap sentence would gut normal paraphrased prose; only identifier-bearing hallucinations are hard-removed
    }
  }

  const removedCount = claims.filter((c) => c.status === 'UNSUPPORTED').length;
  const cleanedAnswer = keptSentences.join(' ').trim();

  return { claims, cleanedAnswer, removedCount, allRemoved: cleanedAnswer.length === 0 && sentences.length > 0 };
}
