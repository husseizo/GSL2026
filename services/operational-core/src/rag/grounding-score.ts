// Pure, cheap hallucination-monitoring heuristic: how much of the generated
// answer's vocabulary actually appears in the retrieved source text. Not a
// semantic entailment check (that would need another LLM call, which is
// its own hallucination risk) — a lexical overlap proxy, explicitly labeled
// as such. A low score means the model said a lot that isn't traceable to
// any retrieved word, which is worth a human's attention even though it
// isn't proof of a fabricated fact. See docs/architecture/evaluation-framework.md.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'for',
  'with', 'this', 'that', 'it', 'as', 'by', 'at', 'from', 'not', 'no', 'if', 'you', 'your', 'i',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

export function computeGroundingScore(answer: string, sourceTexts: string[]): number {
  const answerWords = tokenize(answer);
  if (answerWords.size === 0) return 1;

  const sourceWords = tokenize(sourceTexts.join(' '));
  if (sourceWords.size === 0) return 0;

  let grounded = 0;
  for (const word of answerWords) {
    if (sourceWords.has(word)) grounded += 1;
  }

  return grounded / answerWords.size;
}
