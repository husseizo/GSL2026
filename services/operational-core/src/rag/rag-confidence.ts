// Pure confidence banding over retrieval scores — no DB, no LLM call.
//
// Thresholds are calibrated against real, measured nomic-embed-text cosine
// similarities (see docs/architecture/rag-architecture.md), not a guessed
// 0-centered scale. Mean-pooled sentence embeddings from this model carry a
// high baseline similarity even between unrelated automotive text: a probe
// against a real ignition-coil knowledge chunk scored 0.80 for a genuinely
// matching query ("P0301 misfire"), but still 0.43-0.46 for completely
// unrelated queries ("chocolate cake recipe", "spaceship tyre pressure").
// A naive 0.35 "medium confidence" cutoff would have called those
// unrelated hits MEDIUM confidence — recalibrated so the boundary actually
// separates real matches from baseline noise for this embedding model.
export type RetrievalConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface RetrievalConfidence {
  level: RetrievalConfidenceLevel;
  topScore: number;
}

export function computeRetrievalConfidence(scores: number[]): RetrievalConfidence {
  if (scores.length === 0) return { level: 'NONE', topScore: 0 };

  const topScore = Math.max(...scores);
  if (topScore >= 0.65) return { level: 'HIGH', topScore };
  if (topScore >= 0.5) return { level: 'MEDIUM', topScore };
  if (topScore > 0.4) return { level: 'LOW', topScore };
  return { level: 'NONE', topScore };
}
