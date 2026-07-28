# Offline Evaluation

## Real dataset, self-consistency ground truth

`CatalogueEvaluationService.buildEvalSet()` builds real evaluation cases from real, already-imported catalogue rows — not fabricated examples. The core technique is **self-consistency**: a real part's own real OEM number is used as the query, and that same part's real id is the expected result. This is a legitimate ground truth for exact-identifier retrieval specifically (a system that can't retrieve a record via its own real, unmodified identifier has a real defect), though it does not by itself validate semantic/fuzzy retrieval quality — see limitations below.

A real run built 28 cases from a 20-part sample: 20 `EXACT_OEM`, 5 `FORMATTED_OEM_VARIATION` (the same real OEM number with hyphens inserted), 1 `CONFLICT` (a real part with a genuine category-level disagreement across its source records — see the fix described below), 1 `NO_ANSWER` (a deliberately nonexistent part number), 1 `AMBIGUOUS` (a deliberately vague natural-language query).

## A real bug in the harness itself, found and fixed

The first version of `buildEvalSet()` selected its `CONFLICT` case as "any real part with more than one source reference" — but real profiling from the Data Readiness phase found most multi-source parts (592 of 898) differ only by brand, which is expected aftermarket coverage, not a conflict. This produced a false `expectedConflict: true` label and a misleading `conflictDetectionAccuracy: 0` in the first real run. Fixed by re-checking the real category-disagreement signal (the same one `CatalogueSearchService.hasRealConflict()` uses) before selecting a case as a genuine conflict example; a re-run measured `conflictDetectionAccuracy: 1`.

A second, related bug affected the generation metrics: `avgGroundedness`/`avgUnsupportedClaimRate`/`avgCitationCorrectness` were being computed against bare document-ID strings and the wrong source field, producing `avgGroundedness: 0` and `avgCitationCorrectness: 0` regardless of real answer quality. Fixed by fetching real `KnowledgeChunk.text` for the actual retrieved documents and comparing citations against the real retrieved-sources list. See [decision-log-catalogue-rag.md](decision-log-catalogue-rag.md) for the full writeup, and [source-citations.md](source-citations.md) for why `citationCorrectness` here validates a structural guarantee rather than in-line citation parsing.

## Metrics computed

**Retrieval** (`retrieval-metrics.ts`, pure functions, unit-tested in `retrieval-metrics.spec.ts`): `recallAtK`, `reciprocalRank`/`meanReciprocalRank`, `ndcg`, `exactNumberPreserved` (checks the literal identifier string survived, not just that the right entity was found), `noAnswerPrecision`, `conflictDetectionAccuracy`.

**Generation** (`generation-metrics.ts`, unit-tested in `generation-metrics.spec.ts`): `citationCorrectness`, `citationCompleteness`, `groundednessScore` (thin wrapper around Phase 4's `computeGroundingScore`, reused not reimplemented), `unsupportedTechnicalClaimRate`, `isValidStructuredAnswer`.

## Real measured results (representative sample, not full catalogue)

Three real full-verification runs, after the harness fix, each on the same 28-case dataset shape (3 cases actually exercising the generative path):

| Run | recallAt1/3/5, MRR, nDCG, exactNumberPreservation, noAnswerPrecision, conflictDetectionAccuracy | avgGroundedness | avgCitationCorrectness | avgUnsupportedClaimRate | structuredOutputValidityRate |
|---|---|---|---|---|---|
| 2 | all 1.0 | 0.1999 | 1.0 | 0.3333 | 1.0 |
| 3 (final) | all 1.0 | 0.1838 | 1.0 | 0.5 | 1.0 |

Retrieval metrics are strong and stable across runs, because the dataset is dominated by exact-identifier self-consistency cases, which this architecture is specifically designed to get right deterministically. The generation metrics vary noticeably between runs (0.3333 vs. 0.5 unsupported-claim rate) — with only 3 generative cases and real LLM sampling at `temperature: 0.1` (not `0`), these numbers are real but not yet stable enough to treat as a precise benchmark. What is stable across every run: generation quality is honestly below the spec's acceptance threshold (unsupported technical claims <2%), not smoothed over. See [final-prototype-report.md](final-prototype-report.md) for how this shapes the readiness decision.

## What this dataset does not cover

No held-out human-labeled relevance judgments exist for genuinely fuzzy/semantic queries (only self-consistency-based cases and a small number of hand-written adversarial cases). No systematic multilingual evaluation set exists beyond one real Swahili spot-check. A larger generative-case sample is needed before the exact generation-quality decimals should be treated as representative — the direction (real room for improvement) is clear; the precise magnitude is not yet. These are honest scope limitations for a future iteration, not silently assumed covered.
