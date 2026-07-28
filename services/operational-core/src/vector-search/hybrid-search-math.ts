// Pure scoring/merge logic for keyword and hybrid search — no DB, no
// embeddings. See docs/architecture/vector-search.md.

// Simple term-frequency score, normalized by chunk length, so a short chunk
// that repeats the query term isn't automatically ranked above a long,
// thorough one that mentions it fewer times proportionally.
export function keywordScore(text: string, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let matches = 0;
  for (const term of terms) {
    const occurrences = lowerText.split(term).length - 1;
    matches += occurrences;
  }

  return matches / Math.max(terms.length, 1) / Math.max(Math.sqrt(text.length), 1);
}

export interface ScoredHit {
  chunkId: string;
  score: number;
}

// Merges two independently-scored result sets (e.g. semantic + keyword) into
// one ranked list. Each input list's scores are min-max normalized to [0,1]
// first so one scoring method's raw scale can't dominate the other's just
// because its numbers happen to run larger.
export function mergeWeightedScores(
  semantic: ScoredHit[],
  keyword: ScoredHit[],
  weights: { semantic: number; keyword: number } = { semantic: 0.7, keyword: 0.3 },
): ScoredHit[] {
  const normalizedSemantic = normalize(semantic);
  const normalizedKeyword = normalize(keyword);

  const combined = new Map<string, number>();
  for (const hit of normalizedSemantic) {
    combined.set(hit.chunkId, (combined.get(hit.chunkId) ?? 0) + hit.score * weights.semantic);
  }
  for (const hit of normalizedKeyword) {
    combined.set(hit.chunkId, (combined.get(hit.chunkId) ?? 0) + hit.score * weights.keyword);
  }

  return [...combined.entries()]
    .map(([chunkId, score]) => ({ chunkId, score }))
    .sort((a, b) => b.score - a.score);
}

function normalize(hits: ScoredHit[]): ScoredHit[] {
  if (hits.length === 0) return [];
  const scores = hits.map((h) => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max === min) return hits.map((h) => ({ ...h, score: max === 0 ? 0 : 1 }));
  return hits.map((h) => ({ ...h, score: (h.score - min) / (max - min) }));
}
