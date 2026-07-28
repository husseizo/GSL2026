# Entity Normalization

`src/knowledge-platform/entity-normalization/entity-normalization.ts` implements the spec's explicit distinctions, all as pure, unit-tested functions:

- `normalizeViscosityGrade()` — `5W-30` is normalized for matching/search but the **original form is always retained** alongside the normalized form; `5W-30` never silently becomes `5W30`.
- `normalizePartNumber()` — normalizes for lookup while preserving the original as-printed value.
- `parseTorqueValue()` — extracts value + unit (Nm/lb-ft) with the original string retained.
- `parseFluidQuantity()` — extracts value + unit (L/qt) with the original string retained.
- `distinguishApprovalVsRecommendation()` — approval and recommendation are kept as distinct claim types; a recommendation is never silently promoted to an approval.
- `distinguishFitmentVsCompatibility()` — fitment (confirmed) and compatibility (broader/inferred) are kept distinct.
- `distinguishSupersessionVsAlternative()` — supersession (replaces) and alternative (may substitute) are kept distinct relationship types (`SUPERSEDED_BY` vs `HAS_ALTERNATIVE` graph edges).

## Real bug found and fixed: claim-pattern gap

`CLAIM_TYPE_PATTERNS`'s `approval_statement` regex (`/\bapproval\b|\bapproved\b/i`) never matched pure "recommended" statements, causing a real cross-source approval-vs-recommendation conflict test to miss a genuine conflict (both claims needed the same `claimType` bucket for `detectApprovalStatusConflicts()` to compare them). Fixed by widening the pattern to `/\bapproval\b|\bapproved\b|\brecommend/i` in `knowledge-claim.service.ts` — the two concepts still normalize to distinct claim content, only the *bucketing* regex was widened.

## Real usage

48 real `approval_statement` claims and thousands of `fluid_specification`/`identifier_reference` claims in the live corpus were extracted and normalized through this logic; see [claim-review.md](claim-review.md) for the full breakdown by type.
