// DGX Prototype 1.7.2 — a real BM25 implementation (spec §9 names BM25 as
// a benchmarked retrieval mode). The existing keywordScore()
// (src/vector-search/hybrid-search-math.ts) is a simple term-frequency/
// sqrt(length) scorer, not real BM25 — reusing it under the "BM25" name
// would misrepresent what was actually measured, so this is a real,
// separate, standard Okapi BM25 formula (Robertson/Sparck-Jones, k1=1.2,
// b=0.75 — the standard defaults used by Lucene/Elasticsearch) computed
// from real corpus statistics (document frequency, average document
// length), never approximated.
export const BM25_K1 = 1.2;
export const BM25_B = 0.75;

export interface Bm25CorpusStats {
  totalDocuments: number;
  averageDocumentLength: number;
  documentFrequency: Record<string, number>; // term -> number of documents containing it
}

export interface Bm25Document {
  id: string;
  termFrequencies: Record<string, number>; // term -> count within this document
  length: number; // total term count in this document
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export function buildTermFrequencies(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;
  return freq;
}

export function buildCorpusStats(documents: { text: string }[]): { stats: Bm25CorpusStats; docs: Bm25Document[] } {
  const docs: Bm25Document[] = documents.map((d, index) => {
    const termFrequencies = buildTermFrequencies(d.text);
    const length = Object.values(termFrequencies).reduce((a, b) => a + b, 0);
    return { id: String(index), termFrequencies, length };
  });

  const documentFrequency: Record<string, number> = {};
  for (const doc of docs) {
    for (const term of Object.keys(doc.termFrequencies)) {
      documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
    }
  }

  const totalLength = docs.reduce((a, d) => a + d.length, 0);
  const averageDocumentLength = docs.length > 0 ? totalLength / docs.length : 0;

  return { stats: { totalDocuments: docs.length, averageDocumentLength, documentFrequency }, docs };
}

function idf(term: string, stats: Bm25CorpusStats): number {
  const n = stats.documentFrequency[term] ?? 0;
  // The +1 inside the log keeps IDF non-negative even for terms present in
  // every document (the standard modern BM25 IDF variant used by
  // Lucene/Elasticsearch, avoiding the classic Robertson-Sparck-Jones
  // formula's negative-IDF edge case).
  return Math.log((stats.totalDocuments - n + 0.5) / (n + 0.5) + 1);
}

export function bm25Score(queryText: string, document: Bm25Document, stats: Bm25CorpusStats, k1 = BM25_K1, b = BM25_B): number {
  const queryTerms = tokenize(queryText);
  let score = 0;
  for (const term of queryTerms) {
    const f = document.termFrequencies[term] ?? 0;
    if (f === 0) continue;
    const numerator = f * (k1 + 1);
    const denominator = f + k1 * (1 - b + (b * document.length) / (stats.averageDocumentLength || 1));
    score += idf(term, stats) * (numerator / denominator);
  }
  return score;
}
