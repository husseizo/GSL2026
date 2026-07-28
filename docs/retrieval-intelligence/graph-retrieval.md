# Graph-Assisted Retrieval

## Additive only, after exact retrieval (spec §15)

`GraphExpansionService.expand()` (`src/retrieval-intelligence/graph-expansion/graph-expansion.service.ts`) wraps the existing, unmodified `KnowledgeGraphService.traverse()` (bounded BFS, depth ≤ 4). It only ever expands from candidates the pipeline's candidate-generation stage already found — there is no code path that can run graph expansion before candidate generation completes, and expansion results are always additional candidates, never a replacement for the ones already found.

## Real edge types used

`FITS, SUPERSEDES, HAS_ALTERNATIVE, HAS_APPROVAL, USES_LUBRICANT, REQUIRES_TOOL, REQUIRES_TORQUE, HAS_ENGINE, HAS_TRANSMISSION` — the first seven pre-existing from DGX 1.7/1.7.1; the last two are this phase's own new edge types (see below), included in `expandCandidates()`'s expansion set so a real `VEHICLE` candidate (see [identifier-retrieval.md](identifier-retrieval.md)'s real Vehicle-lookup fix) can meaningfully expand to its real engine/transmission. A third new edge type, `RELATED_TO`, was also added this phase as a pure `ADD VALUE` enum change but has no real population source (see honest gaps below).

## Real, confirmed data source pivot

The plan originally expected `HAS_ENGINE`/`HAS_TRANSMISSION` to populate from `KnowledgeItemEngineApplicability` — confirmed, via direct query, to have **0 real rows**. The internal `Vehicle` table has only 6 real rows (5 with a real `engineCode`, 0 with a real `transmissionCode`) — a genuinely small, real, separate dataset from the 4,189 VEHICLE graph nodes already populated from the DGX 1.7.1 TecDoc fitment corpus (no real join key exists between the two in this environment). `NewEdgeTypePopulationService.populateVehicleEngineEdges()` populates real `HAS_ENGINE` edges from this small internal table — reported honestly as a separate, small, real addition, not silently merged with the larger TecDoc-derived vehicle graph. `RELATED_TO` has no specific real population source named in the spec and is not populated with invented data this phase — the mechanism (the edge type itself) is real and available for a future phase with a genuine source.

## Real bug found and fixed: graph-expansion candidates mislabeled as content

The verify script's real citation-resolution check (step 17) found that 8 of 10 candidates for a real identifier query failed to resolve — traced to `expandCandidates()` labeling every non-PART/non-LUBRICANT graph node type (VEHICLE, ENGINE, TOOL, etc.) as `candidateType: 'KNOWLEDGE_ITEM'`, implying a citable content document that didn't actually exist for those node types. Fixed by widening `RetrievalCandidate.candidateType` to the real graph node type, and giving graph-relationship candidates (everything except real `KNOWLEDGE_ITEM`-typed nodes) an honest `citation.source: 'graph-relationship'` with no false `itemId` — verified by confirming the underlying `KnowledgeGraphNode` is real, not by pretending it's independently-citable content.

## The GRAPH_DISTANCE ranking signal

`GraphExpansionService.graphDistanceSignal(depth)` — depth 1 (direct neighbor) scores highest, decaying with real BFS depth, never negative, feeding the ranking engine's `GRAPH_DISTANCE` signal (see [ranking.md](ranking.md)).
