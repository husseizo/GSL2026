# Structured Technical Facts

One polymorphic `StructuredFact` table with a `factType` discriminator (`TORQUE_SPEC | FLUID_CAPACITY | FLUID_TYPE | SERVICE_INTERVAL | FITMENT | ELECTRICAL_SPEC | PRESSURE_SPEC | CLEARANCE_SPEC | PART_DIMENSION | WEIGHT_SPEC | WARRANTY_TERM | DIAGNOSTIC_THRESHOLD | OTHER`) — not the spec's literal 14-table enumeration. Every fact type shares the identical real shape (`value`/`unit`/`conditions`/`confidence`); see `decision-log.md` for the full rationale. Service: `StructuredFactService` (`src/knowledge-platform/structured-facts/`).

## The real gate: `extractedBy`

`extractedBy: 'MANUAL_ENTRY' | 'PARSER_DETERMINISTIC' | 'LLM_ASSISTED_FLAGGED_FOR_REVIEW'` is the real, structural mechanism enforcing "never rely on an LLM summary for torque/fluid/safety/fitment data":

- `MANUAL_ENTRY` and `PARSER_DETERMINISTIC` facts are always AI-consumer visible — they never came from an LLM summary in the first place.
- `LLM_ASSISTED_FLAGGED_FOR_REVIEW` facts are excluded from the AI-consumer contract until a real human sets `reviewedAt` via `review()`.

`aiConsumerVisible(fact)` is the pure predicate; `listAiConsumerVisibleFacts(itemId)` is what every real caller (`KnowledgeRetrievalService`) must use — never a direct `structuredFact.findMany()`. Verified end-to-end by the verify script (steps 23–25): a manual fact is visible immediately, an LLM-assisted fact is excluded pre-review, and becomes visible only after a real review.

**Real, named risk**: this gate is enforced in the service layer, not the database. A future direct-Prisma query bypassing `StructuredFactService` could leak an unreviewed LLM-assisted fact — the same accepted risk class the codebase already carries for `KnowledgeDocument.isApproved`.
