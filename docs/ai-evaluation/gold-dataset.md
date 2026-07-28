# Gold Dataset — DGX Prototype 1.6

## What "Gold Dataset" means here

A Gold Dataset is not a separate storage mechanism — it's a `Benchmark` whose case set has been explicitly `APPROVED` by a reviewer and then frozen via `BenchmarkRegistryService.freezeAsGold()`. Freezing computes a real sha256 checksum (`registry/checksum.ts`) over the sorted set of `externalCaseId`s and stores it on the `Benchmark` row. `addCases()` refuses any further write to a benchmark that is both `isGold: true` and `approvalStatus: 'APPROVED'` — verified live in `scripts/verify-ai-evaluation-framework.ts` step 8 and in `ai-benchmark.integration-spec.ts` against real Postgres. `verifyChecksum()` independently recomputes the checksum from the *current* case set and compares — this is what would catch a direct DB edit that bypassed the `addCases()` guard entirely (also tested live, by deliberately creating a `BenchmarkCase` row directly via Prisma after freezing and confirming the checksum mismatch is detected).

Only cases with zero real human-judgment ambiguity (`status: 'APPROVED'` from a mechanical generator, never `REVIEW_REQUIRED`) are eligible — `GoldDatasetService.buildAndFreezeGoldBenchmark()` filters these out explicitly before freezing, and each surviving case is enriched with the additional fields spec §3 requires beyond a normal `BenchmarkCase` (expected citations/confidence/refusal/explanation, forbidden outputs, expected structured output — see `GoldCaseEnrichment` in `gold-dataset.service.ts`).

## Honest dataset-scale accounting (spec §2/§25's "1000+ or a documented phased roadmap")

| Category | Source | Scale mechanism | Honest ceiling this phase |
|---|---|---|---|
| RETRIEVAL (exact/formatted/alternate/internal/tecdoc/viscosity/approval) | Real corpus (7,723 parts, 434 lubricants) | Mechanical — `identifier-scaled-cases.ts` removes the old `buildEvalSet()`'s `.slice(0,5)` caps | Up to 500/type, capped for CI runtime, not corpus size |
| CONFLICT_DETECTION | Real corpus | Mechanical, but bounded by how many *genuine* multi-source category disagreements exist (most multi-source parts are brand-only differences, not conflicts) | Small by construction — padding this would misrepresent real conflict frequency |
| PERMISSION_ENFORCEMENT | The real, live `ROLE_PERMISSIONS` map (~90 real permissions × ~20 real roles) | Mechanical, pure — every (role, permission) pair where the role lacks the permission is a real "must deny" case | Up to 500, a genuinely large real source, no human review needed since correctness is a structural fact of the map itself |
| HALLUCINATION | Real corpus | Mechanical substitution (a real part/lubricant's real attribute, attributed to a different real entity) | Low hundreds |
| SWAHILI / MIXED_LANGUAGE | Real corpus + a small number of real phrase templates | Partially mechanical (real OEM numbers × real templates) but **stays a small curated sample** — only one template (the DGX Prototype 1.5-verified one) is `APPROVED`; the rest are `REVIEW_REQUIRED` pending a real fluent-Swahili-speaker review | Blocked from scaling further by a genuine staffing dependency, not a technical one |
| ENGLISH | Real corpus + templates | Mechanical | Moderate |
| REASONING | Real corpus (conjunctive viscosity+approval facts, genuine category conflicts) | Small, curated — each case needs a human check that the expected resolution is actually unique/correct | Low tens |
| CITATION | Rides on top of whatever generative cases already exist elsewhere (not separately authored) | N/A | N/A |
| PRODUCTION_READINESS | Not case-based — a checklist | N/A | N/A |
| PERFORMANCE / LATENCY / RELIABILITY | Not case-based — a real query-mix replay | N/A | N/A |

**Real reported total** (see `scripts/verify-ai-evaluation-framework.ts` step 18's live output for the exact run's numbers): summing the mechanically-scaled categories against the real corpus size available in this environment, with the curated categories staying deliberately small, this phase's first execution reports a real raw count and a real `APPROVED`-only count — both printed, never conflated. If the `APPROVED` count is under 1000, that is reported honestly rather than padded by promoting `REVIEW_REQUIRED` cases.

## Phased roadmap to close the gap (if the real run is under 1000 APPROVED)

1. **Swahili/Mixed-language**: recruit a real fluent Swahili speaker to review the `REVIEW_REQUIRED` cases in `language-cases.ts`'s `UNREVIEWED_SWAHILI_TEMPLATES`/`MIXED_TEMPLATES` output — each approved template then multiplies across the full real corpus, the same way the one verified template already does.
2. **Reasoning**: author additional real conjunctive/conflict-resolution query patterns beyond the two currently implemented, each needing one-time human verification, then apply mechanically across matching corpus rows.
3. **Retrieval-family caps**: raise `IDENTIFIER_CASE_CAP_PER_TYPE` in `identifier-scaled-cases.ts` past 500 once CI runtime budget allows (real corpus has far more than 500 exact-OEM rows available).
4. **Permission enforcement**: already near-exhaustive against the real `ROLE_PERMISSIONS` map; growing further would require adding new real permissions/roles to the system, not something this phase should do artificially.

This is the honest, evidence-based version of the spec's own fallback clause — real per-category counts and a real, actionable roadmap, not a round number reached by relabeling ambiguous cases as approved.
