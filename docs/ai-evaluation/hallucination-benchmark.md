# Hallucination Benchmark — DGX Prototype 1.6 (spec §12)

## Design decision (confirmed with the user during planning)

Hallucination is not a top-level `BenchmarkCategory` — the spec's own 16-item category list (§4) never names it — but it IS a dedicated, independently-scored, independently-documented sub-benchmark, nested as `HallucinationSubScore` inside `GENERATION`'s `CategoryMetrics`. See `benchmark-architecture.md` for the full reasoning.

## Mechanical construction

`src/ai-benchmark/categories/hallucination-cases.ts`'s `buildHallucinationCases()` takes a real part/lubricant and substitutes a plausible-but-wrong value from a *different* real entity:

- **INVALID_OEM**: part A probed with part B's real OEM number.
- **INVALID_LUBRICANT_APPROVAL**: lubricant A probed with lubricant B's real verified approval code.
- **INVALID_COMPATIBILITY**: a real part probed against an unrelated real vehicle's real make/model/year.
- **UNSUPPORTED_DIAGNOSIS** / **UNSUPPORTED_EQUIVALENCE**: structurally correct regardless of corpus content (the assistant must never diagnose a fault or assert unverified equivalence) — a small, fixed, human-authored pair rather than corpus-derived.

"Is this substituted value real" is a structural fact (real if attributed to a different actual entity, wrong if attributed to this one) — this is what lets the category scale into the low hundreds without per-case human authorship, unlike Swahili/Reasoning cases.

## Scoring

`computeHallucinationSubScore()` (in the same file) is a pure aggregation function producing one rate per subtype (`invalidOemRate`, `invalidFitmentRate`, `invalidLubricantApprovalRate`, `invalidCompatibilityRate`, `invalidCitationRate`, `unsupportedDiagnosisRate`, `unsupportedEquivalenceRate`) plus an `overallHallucinationRate` — every hallucination is classified by subtype, never just counted as one number (spec's explicit rule).

`BenchmarkPipelineService.runGenerationCategory()` executes each hallucination case through the real `CatalogueRagService.ask()` and checks whether the substituted value was asserted as fact in the real answer text at a non-refused confidence level (`answer.confidence !== 'INSUFFICIENT_EVIDENCE' && !== 'CONFLICTING'`) — this reuses the exact same architecture that already makes DGX Prototype 1.5's claim verifier remove unsupported identifier claims, so a well-behaved system should score at or near 0 on every subtype by construction of the pipeline, not by construction of the metric.

## Real test coverage

`hallucination-cases.spec.ts` (pure, no DB): zero-sample case returns all-zero rates; a real per-subtype rate is computed independently of other subtypes (a 100% `INVALID_OEM` rate does not affect `unsupportedDiagnosisRate`).
