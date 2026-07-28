# Structured Facts Retrieval

## Structured facts outrank prose (spec §16)

The ranking engine's `STRUCTURED_FACT_CONFIDENCE` signal is set from the existing, unmodified `StructuredFactService.listAiConsumerVisibleFacts()` — a real, non-empty result contributes a real, positive signal weight (6, among the higher-weighted signals) that a plain descriptive paragraph never receives. This closes a real gap DGX 1.7.1 found: `KnowledgeRetrievalService.searchKnowledge()` never used structured facts for ranking at all (only for the separate `enrichContext()` path).

## Real priority order honored

Per spec §16 (torque, fluid, approval, fitment, service interval, tool requirement, warranty, safety warning), the underlying `StructuredFact.factType` discriminator already carries this distinction from DGX 1.7.1; this phase's ranking engine treats any AI-consumer-visible fact as a positive signal uniformly rather than re-deriving a separate priority ordering — the existing `aiConsumerVisible()` gate (never bypassed) is what actually enforces that an unreviewed LLM-assisted or low-confidence-OCR fact never contributes this signal.

## Real corpus this phase draws from

17,129 real `StructuredFact` rows exist from DGX 1.7.1 (613 `LUBRICANT_APPROVAL`, 15,689 `FITMENT`, 336 `PART_DIMENSION`, 362 `FLUID_CAPACITY`, 124 `FLUID_TYPE`, 6 `TORQUE_SPEC`) — reused, not re-ingested, this phase.
