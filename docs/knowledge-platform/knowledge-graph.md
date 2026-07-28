# Postgres-Relational Knowledge Graph

Per the user's explicit instruction to "prefer beginning with PostgreSQL relationships... do not introduce a separate graph database unless benchmarks show a clear requirement," the graph is 2 tables — `KnowledgeGraphNode`/`KnowledgeGraphEdge` — not one table per node type. See `KnowledgeGraphService` (`src/knowledge-platform/graph/`).

## Model

Nodes are polymorphic-by-convention (`nodeType`/`refId`), the same pattern `AuditLog.entityType`/`entityId` already uses in this codebase — `refId` points at a different real table depending on `nodeType`, never a hard FK.

`KnowledgeGraphNodeType`: `KNOWLEDGE_ITEM | VEHICLE | PART | ENGINE | FAULT_CODE | PROCEDURE_STEP | KNOWLEDGE_SOURCE | LUBRICANT`.
`KnowledgeGraphEdgeType`: `APPLIES_TO | SUPERSEDES | CONFLICTS_WITH | DERIVED_FROM | REFERENCES | CAUSED_BY | RESOLVED_BY | HAS_APPROVAL | USES_LUBRICANT`.

`LUBRICANT`/`HAS_APPROVAL`/`USES_LUBRICANT` were added via a second, purely additive migration mid-phase after a real gap was found: the initial enum set had no way to represent "this lubricant is approved for this part" (see `decision-log.md`).

## Traversal — a deliberate ceiling

`traverse(startNodeType, startRefId, edgeTypes, maxDepth)` is bounded-depth BFS only, capped at `MAX_TRAVERSAL_DEPTH = 4` regardless of the caller's request. No shortest-path or PageRank-style ranking exists — a named ceiling to avoid scope creep into a full graph-analytics feature that was never asked for. Verified end-to-end by the verify script for both a vehicle→part relationship (step 34) and a part→lubricant→approval relationship (step 35, `PART -USES_LUBRICANT-> LUBRICANT -HAS_APPROVAL-> KNOWLEDGE_ITEM`).

## Real, honest scoping

`upsertNode()`/`upsertEdge()` are the only write paths; there is no bulk graph-rebuild job — the CLI's `rebuild-graph` command exists but explains that nodes/edges are meant to be updated incrementally at publish time, and a standalone rebuild is only needed when recovering from data loss (see `cli-reference.md`).
