// Pure retrieval-metric functions — no DB, no I/O. See
// docs/ai/offline-evaluation.md.
export interface RankedResult {
  entityId: string;
}

export function recallAtK(retrieved: RankedResult[], expectedIds: string[], k: number): number {
  if (expectedIds.length === 0) return retrieved.length === 0 ? 1 : 0;
  const topK = retrieved.slice(0, k).map((r) => r.entityId);
  const hits = expectedIds.filter((id) => topK.includes(id)).length;
  return hits / expectedIds.length;
}

// AI Foundation Certification Sprint (spec §21: "Precision@1 >= agreed
// target") — the one real metric named in spec §5/§21 that had never
// actually been implemented despite being planned in DGX 1.7.2. Real,
// pure, no DB — precision is over the top-K slice itself (denominator
// K), distinct from recallAtK's denominator (expectedIds.length).
export function precisionAtK(retrieved: RankedResult[], expectedIds: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return expectedIds.length === 0 ? 1 : 0;
  const hits = topK.filter((r) => expectedIds.includes(r.entityId)).length;
  return hits / topK.length;
}

// Mean reciprocal rank for a single query — 1/rank of the first correct
// result, 0 if none of the expected ids appear at all.
export function reciprocalRank(retrieved: RankedResult[], expectedIds: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (expectedIds.includes(retrieved[i].entityId)) return 1 / (i + 1);
  }
  return 0;
}

export function meanReciprocalRank(perQueryReciprocalRanks: number[]): number {
  if (perQueryReciprocalRanks.length === 0) return 0;
  return perQueryReciprocalRanks.reduce((a, b) => a + b, 0) / perQueryReciprocalRanks.length;
}

// Normalized Discounted Cumulative Gain — binary relevance (1 if the
// result id is in the expected set, 0 otherwise), standard log2 discount.
export function ndcg(retrieved: RankedResult[], expectedIds: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const relevance = expectedIds.includes(topK[i].entityId) ? 1 : 0;
    dcg += relevance / Math.log2(i + 2);
  }

  const idealHits = Math.min(expectedIds.length, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg > 0 ? dcg / idcg : retrieved.length === 0 && expectedIds.length === 0 ? 1 : 0;
}

export interface ExactNumberCase {
  queryIdentifier: string;
  retrievedIdentifiers: string[];
  expectedIdentifier: string;
}

// "Exact OEM-number preservation" (spec §11/§27) — did the retrieved
// result's real identifier exactly match what was queried, with no
// merging/mangling introduced by normalization. This is checked
// separately from recall@K because it specifically verifies the
// IDENTIFIER STRING itself survived retrieval unchanged, not just that
// the right canonical entity was found.
export function exactNumberPreserved(testCase: ExactNumberCase): boolean {
  return testCase.retrievedIdentifiers.includes(testCase.expectedIdentifier);
}

export interface NoAnswerCase {
  expectedNoAnswer: boolean;
  systemSaidNoAnswer: boolean;
}

// Precision of the system's "I don't have enough evidence" behavior —
// of every case where the system claimed no answer, how many genuinely
// had no real ground truth (vs. wrongly declining to answer a real one).
export function noAnswerPrecision(cases: NoAnswerCase[]): number {
  const claimedNoAnswer = cases.filter((c) => c.systemSaidNoAnswer);
  if (claimedNoAnswer.length === 0) return 1;
  const correct = claimedNoAnswer.filter((c) => c.expectedNoAnswer).length;
  return correct / claimedNoAnswer.length;
}

export interface ConflictDetectionCase {
  expectedConflict: boolean;
  systemFlaggedConflict: boolean;
}

export function conflictDetectionAccuracy(cases: ConflictDetectionCase[]): number {
  if (cases.length === 0) return 1;
  const correct = cases.filter((c) => c.expectedConflict === c.systemFlaggedConflict).length;
  return correct / cases.length;
}
