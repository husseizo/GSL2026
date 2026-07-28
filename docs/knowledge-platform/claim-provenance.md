# Claim-Level Provenance

`KnowledgeClaim` is the real mechanism ensuring every technical claim is traceable to an exact quoted substring of its source version's `rawContent` — not just "this document says so" at the document level (which is all `KnowledgeDocument.source`/`sourceUri` ever gave). See `KnowledgeClaimService` (`src/knowledge-platform/provenance/`).

## Deterministic extraction, never an LLM call

`extractCandidateClaims()` splits `rawContent` into sentences and flags a sentence as a candidate claim only if it matches a real, named pattern: `torque_value`, `fluid_specification`, `supersession_statement`, `fitment_statement`, `approval_statement`, `service_interval`, or `identifier_reference`. Intentionally a coarse, honest heuristic, not a trained extractor — matches the spec's own rule that claim-level data must never rest solely on an LLM summary.

Every extracted claim persists with `evidenceQuote` set to the exact matched sentence — verified by the verify script (step 22) to always be a real substring of the version's `rawContent`.

## Verification lifecycle

Every claim starts `UNVERIFIED`. `verifyClaim()` transitions to `VERIFIED | DISPUTED | RETRACTED`, always by a real reviewer, always audit-logged. Nothing in the extraction path auto-approves a claim.
