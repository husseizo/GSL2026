# Source Citations

## Citation shape

Every `CatalogueRagAnswer.sources` entry carries: `sourceSystem`, `sourceRecordId`, `canonicalEntityId`, `lastVerifiedDate`. On the deterministic path this is populated directly from the real matched `Part`/`LubricantProduct` row; on the generative path it's built from `RagAnswer.sources` (Phase 4), mapping `sourceType` → `sourceSystem` and `documentId` → both `sourceRecordId` and `canonicalEntityId`.

The LLM itself is never cited as a source — `sources` is assembled by real application code from real retrieved records, never from the model's own text output claiming to be a source.

## What "citation correctness" actually validates in this architecture

`CatalogueRagService`'s generative path feeds the LLM only real retrieved chunks as context and lists exactly those chunks in `sources` — there is no filtering step where the system selectively cites a subset of what it retrieved. This means `generation-metrics.ts`'s `citationCorrectness()`, as wired into `CatalogueEvaluationService.runEvaluation()`, validates a real structural invariant ("every source handed to the LLM is a real retrieved record, never fabricated"), not "the LLM's free-text answer explicitly referenced each cited source by name." The latter would require parsing in-line citation markers out of the generated text, which `CatalogueRagService` does not yet implement. This is documented here as a known limitation rather than presented as a stronger guarantee than what was actually built — see the comment in `catalogue-evaluation.service.ts`'s `runEvaluation()`.

## A real bug found and fixed in the evaluation harness itself

The first real offline evaluation run measured `avgCitationCorrectness: 0` and `avgGroundedness: 0` — both were evaluation-harness bugs, not real generation defects. `runEvaluation()` was comparing citations against `ragAnswer.matchingProducts` (a field only ever populated on the *deterministic* path, always empty on the generative path being measured) instead of the real retrieved source list, and was passing bare `sourceRecordId` strings (document IDs) into `computeGroundingScore()` instead of the actual retrieved chunk text. Both were fixed: citation correctness now compares against the real `sources` list, and groundedness/unsupported-claim-rate now fetch real `KnowledgeChunk.text` by document id before scoring. A re-run after the fix produced `avgCitationCorrectness: 1`, `avgGroundedness: 0.1999`, `avgUnsupportedClaimRate: 0.3333` — plausible, real numbers instead of artifacts of a broken harness. See [decision-log-catalogue-rag.md](decision-log-catalogue-rag.md).

## Verification status per citation

`lastVerifiedDate` is currently always `null` in this build — no per-document "last verified" timestamp has been wired through from `KnowledgeDocument` yet (it exists as a real column on several catalogue models but wasn't populated during this phase's corpus builds). This is an honest gap, not a silent omission: it means a UI rendering these citations cannot yet show a real recency signal and should not claim one.
