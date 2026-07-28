// DGX Prototype 1.7 — Postgres-relational Knowledge Graph (spec §23).
//
// 2 tables, not one per node type, per the explicit instruction to prefer
// relational storage and avoid premature graph-database complexity.
// traverse() is deliberately scoped to bounded-depth BFS only — no
// shortest-path/PageRank-style ranking, a named ceiling documented in
// docs/knowledge-platform/knowledge-graph.md to avoid scope creep.
import { Injectable } from '@nestjs/common';
import { KnowledgeGraphEdgeType, KnowledgeGraphNodeType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_TRAVERSAL_DEPTH = 4;

export interface TraversalResult {
  nodeId: string;
  nodeType: KnowledgeGraphNodeType;
  refId: string;
  label: string;
  depth: number;
  viaEdgeType: KnowledgeGraphEdgeType | null;
}

@Injectable()
export class KnowledgeGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertNode(nodeType: KnowledgeGraphNodeType, refId: string, label: string, metadata?: Record<string, unknown>) {
    return this.prisma.knowledgeGraphNode.upsert({
      where: { nodeType_refId: { nodeType, refId } },
      create: { nodeType, refId, label, metadata: metadata as object | undefined },
      update: { label, metadata: metadata as object | undefined },
    });
  }

  async upsertEdge(fromNodeId: string, toNodeId: string, edgeType: KnowledgeGraphEdgeType, weight?: number, evidence?: Record<string, unknown>) {
    return this.prisma.knowledgeGraphEdge.upsert({
      where: { fromNodeId_toNodeId_edgeType: { fromNodeId, toNodeId, edgeType } },
      create: { fromNodeId, toNodeId, edgeType, weight, evidence: evidence as object | undefined },
      update: { weight, evidence: evidence as object | undefined },
    });
  }

  // Bounded-depth BFS only — the deliberate ceiling. depth is capped at
  // MAX_TRAVERSAL_DEPTH regardless of the caller's request, so a
  // pathological graph can never produce an unbounded query.
  async traverse(startNodeType: KnowledgeGraphNodeType, startRefId: string, edgeTypes: KnowledgeGraphEdgeType[], maxDepth = MAX_TRAVERSAL_DEPTH): Promise<TraversalResult[]> {
    const cappedDepth = Math.min(maxDepth, MAX_TRAVERSAL_DEPTH);
    const startNode = await this.prisma.knowledgeGraphNode.findUnique({ where: { nodeType_refId: { nodeType: startNodeType, refId: startRefId } } });
    if (!startNode) return [];

    const visited = new Map<string, TraversalResult>();
    visited.set(startNode.id, { nodeId: startNode.id, nodeType: startNode.nodeType, refId: startNode.refId, label: startNode.label, depth: 0, viaEdgeType: null });

    let frontier = [startNode.id];
    for (let depth = 1; depth <= cappedDepth && frontier.length > 0; depth++) {
      const edges = await this.prisma.knowledgeGraphEdge.findMany({
        where: { fromNodeId: { in: frontier }, edgeType: { in: edgeTypes } },
        include: { toNode: true },
      });

      const nextFrontier: string[] = [];
      for (const edge of edges) {
        if (visited.has(edge.toNodeId)) continue;
        visited.set(edge.toNodeId, { nodeId: edge.toNodeId, nodeType: edge.toNode.nodeType, refId: edge.toNode.refId, label: edge.toNode.label, depth, viaEdgeType: edge.edgeType });
        nextFrontier.push(edge.toNodeId);
      }
      frontier = nextFrontier;
    }

    return [...visited.values()];
  }
}
