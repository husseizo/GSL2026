# Ground-Truth Governance

## Implementation

`src/catalogue-ai/evaluation/ground-truth.ts` defines the governance layer as a typed model over the existing offline-evaluation cases, rather than a new Prisma model — evaluation-case governance is metadata on an existing concept, not a new business entity, so no schema migration was needed.

```ts
type GroundTruthStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'APPROVED' | 'CONFLICTING' | 'RETIRED';
```

Every `CatalogueEvalCase` produced by `CatalogueEvaluationService.buildEvalSet()` carries a real `groundTruthStatus`. `runEvaluation()` calls `cases.filter(c => c.groundTruthStatus === 'APPROVED')` before computing any metric — **unapproved cases structurally cannot affect official acceptance numbers**, not just by documented convention.

## How status is actually assigned

- **Self-consistency cases** (a real part's own real OEM number, internal code, alternate number, TecDoc id, viscosity, or verified lubricant approval retrieving that same real record) are marked `APPROVED` directly — the ground truth here is a deterministic derivation from real, already-imported catalogue data, not a human judgment call, so no separate human review step is required for correctness.
- **Ambiguous, partial-description, and misspelled-description cases** are marked `REVIEW_REQUIRED` — what counts as an "acceptable" answer to a deliberately vague or malformed query is inherently a judgment call, and this phase has exactly one reviewer (the same identity operating this session) rather than a real multi-person review panel. Marking these `REVIEW_REQUIRED` rather than `APPROVED` is the honest reflection of that — they are excluded from official metrics until a real second reviewer looks at them.
- **Adversarial safety cases** (prompt injection, unsupported diagnostic request) are marked `APPROVED` — their correct outcome (refusal) is structural, not a judgment call.

## Honest limitation: no real inter-reviewer disagreement tracking

The spec asks for "inter-reviewer disagreement tracking where multiple reviewers are available." No second reviewer was available in this environment this phase — this is reported honestly rather than fabricating a second reviewer's sign-off. The `GroundTruthCase` type includes a `reviewedById` field ready to carry a second real identity whenever that becomes available; no code change would be needed to start using it.

## Real numbers from this phase's dataset

`REVIEW_REQUIRED` is assigned to the `AMBIGUOUS` case plus any real `PARTIAL_DESCRIPTION`/`MISSPELLED_DESCRIPTION` cases the dataset builder found data for; every other real case is `APPROVED`. The exact real counts for this run are recorded by `groundTruthSummary()`'s output, logged in `scripts/verify-dgx-prototype-1-5.ts` step 10's real console output and in [final-tuning-report.md](final-tuning-report.md).
