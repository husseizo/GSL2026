# AI Foundation Certification Sprint — Optimization Log

Every real, evidence-based change made this sprint, in chronological order, each with the real before/after measurement that justified it. See [identifier-analysis.md](identifier-analysis.md) for full root-cause detail on the identifier-classification bugs, and [ranking-experiments.md](ranking-experiments.md) for the ranking-weight investigation.

| # | Change | File(s) | Evidence before fixing | Measured after |
|---|---|---|---|---|
| 1 | Drop letter requirement from generic alphanumeric fallback | `query-classifier.ts` | Direct query: 38.6% of real OEM numbers are pure numeric, all falling to `UNKNOWN` | 5/10 reproduced `EXACT_OEM` failures fixed |
| 2 | Return `trimmed` not `relaxed` as `candidateIdentifier` | `query-classifier.ts` | Two real duplicate Part rows, wrong one strict-matched | Confirmed via new unit test |
| 3 | Tolerate trailing `+` in whole-string and embedded patterns | `query-classifier.ts` | Direct query: real stored value `1K0853651E+` | Confirmed via new unit test |
| 4 | Add local `embeddedNumeric`/`embeddedAlphanumericPlus` patterns | `query-classifier.ts` | Direct query: 99.6% of pure-numeric OEM numbers are 6-13 digits | Confirmed via new unit test |
| 5 | Deterministic secondary sort by candidate `id` | `retrieval-pipeline.service.ts` | 18 real duplicate-OEM groups, no tie-break | Reproducible ranking order |
| 6 | Suppress vector-origin candidates when identifier-shaped + no real exact match | `retrieval-pipeline.service.ts` | Real 0.7 cosine similarity for a nonexistent identifier query | New integration test: `confidence=0`, `candidates.length=0` |
| 7 | Candidate-origin tagging + `RetrievalQueryLog.candidateCounts` population | `retrieval-pipeline.service.ts` | Spec §7: candidate generation must become measurable | Populates existing, previously-underused column |
| 8 | `classifyRetrievalFailure()` wired into gate computation | `retrieval-intelligence-quality-gates.ts` | Spec §15: every failure must become engineering work | Real `RetrievalFailureType` persisted per failing case |
| 9 | New observability metrics (identifier hit/miss rate, candidate count, rank accuracy, graph/ranking-signal usage, certification progress) | `metrics.service.ts` | Spec §19 | Wired into real call sites, no synthetic values |
| 10 | 150-case gate re-run #1 | — | Baseline: Recall@1=0.687, MRR=0.699, IdentifierAccuracy=0.702 | Recall@1=0.88, MRR=0.892, IdentifierAccuracy=0.934 |
| 11 | 150-case gate re-run #2 (after fixes 2-4) | — | — | Recall@1=0.973, MRR=0.987, IdentifierAccuracy=1.00 (150-case sample) |
| 12 | Full 1,840-case run #1 | — | 150-case sample looked fully passing | IdentifierAccuracy=0.9974 (FAIL) — a real gap the small sample missed |
| 13 | Round-1 identifier fixes (length bounds `{3,100}`, `ENGINE_CODE_ALPHA_PATTERN`) + segmented-identifier guard | `query-classifier.ts` | 4 real failures root-caused (§identifier-analysis.md) | IdentifierAccuracy=0.9987 (still FAIL, 1-2 cases short) |
| 14 | Round-2 fix (strip separators before judging a group "word-like") | `query-classifier.ts` | 2 real remaining failures, both dash-spelled OEM shapes | **IdentifierAccuracy=1.00 exactly** |
| 15 | Full 1,840-case run #3 | — | — | **ALL 10 GATES PASS** |
| 16 | Gold Dataset v2 built (1,840 carried forward + 11 new real cases) | `build-retrieval-intelligence-gold-eval-v2.ts` | Spec §16: lock in regression coverage with real data | 1,851 cases, checksum verified |

## Ranking weights: not touched

The sprint's plan reserved capacity for `DEFAULT_SIGNAL_WEIGHTS`/BM25-parameter tuning (spec §8/§9) if a residual gap remained after the identifier fixes. It did not — every gate passed once classification and candidate-generation bugs were fixed. No ranking weight was changed this sprint; see [ranking-experiments.md](ranking-experiments.md) for the honest record of why that work was not needed.

## Regression discipline

Every single change above was followed by the full existing unit + integration suite before being considered done. Final count: **146/146 suites, 862/862 tests, zero failures** — up from 857 tests at the sprint's midpoint, purely from new tests added alongside each fix, never a net decrease.
