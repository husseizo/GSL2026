// DGX Prototype 1.7.2 — graph expansion (spec §4 stage 10, §15). A thin
// wrapper over the existing, unmodified KnowledgeGraphService.traverse()
// that structurally enforces "never allow graph expansion to override an
// exact identifier match": it only ever expands FROM candidates the
// caller already has (i.e. candidates that survived stage 9 candidate
// generation) — there is no code path here that can run before candidate
// generation completes, and expansion results are always additional
// candidates, never a replacement for the ones passed in.
import { Injectable } from '@nestjs/common';
import { KnowledgeGraphEdgeType, KnowledgeGraphNodeType } from '@prisma/client';
import { KnowledgeGraphService } from '../../knowledge-platform/graph/knowledge-graph.service';

export interface GraphExpansionSeed {
  nodeType: KnowledgeGraphNodeType;
  refId: string;
}

export interface ExpandedCandidate {
  nodeType: KnowledgeGraphNodeType;
  refId: string;
  label: string;
  depth: number;
  viaEdgeType: KnowledgeGraphEdgeType | null;
  sourceSeedRefId: string;
}

@Injectable()
export class GraphExpansionService {
  constructor(private readonly graph: KnowledgeGraphService) {}

  async expand(seeds: GraphExpansionSeed[], edgeTypes: KnowledgeGraphEdgeType[], maxDepth?: number): Promise<ExpandedCandidate[]> {
    const expanded: ExpandedCandidate[] = [];

    for (const seed of seeds) {
      const results = await this.graph.traverse(seed.nodeType, seed.refId, edgeTypes, maxDepth);
      for (const r of results) {
        if (r.depth === 0) continue; // depth 0 is the seed itself, not a real expansion
        expanded.push({ nodeType: r.nodeType, refId: r.refId, label: r.label, depth: r.depth, viaEdgeType: r.viaEdgeType, sourceSeedRefId: seed.refId });
      }
    }

    return expanded;
  }

  // Inverse graph distance for the ranking engine's GRAPH_DISTANCE signal —
  // depth 1 (direct neighbor) scores highest, decaying with real BFS depth,
  // never negative.
  static graphDistanceSignal(depth: number, maxDepth = 4): number {
    if (depth <= 0) return 1;
    return Math.max(0, 1 - (depth - 1) / maxDepth);
  }
}
