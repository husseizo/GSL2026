// Pluggable scoring interface. Phase 1 ships a deterministic token-overlap
// implementation; Phase 5 (docs/architecture/03-ai-platform.md) substitutes an
// embedding-based scorer from the DGX Spark platform without changing anything
// in PartMatcherService other than which implementation gets injected.
export interface SimilarityScorer {
  /** Returns a similarity score in [0, 1] between two already-standardized strings. */
  score(a: string, b: string): number;
}

export class TokenOverlapSimilarityScorer implements SimilarityScorer {
  score(a: string, b: string): number {
    const tokensA = new Set(a.split(' ').filter(Boolean));
    const tokensB = new Set(b.split(' ').filter(Boolean));
    if (tokensA.size === 0 || tokensB.size === 0) {
      return 0;
    }

    let intersectionSize = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) {
        intersectionSize += 1;
      }
    }

    const unionSize = tokensA.size + tokensB.size - intersectionSize;
    return unionSize === 0 ? 0 : intersectionSize / unionSize;
  }
}
