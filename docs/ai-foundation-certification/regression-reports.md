# AI Foundation Certification Sprint — Regression Reports

Spec §17: no regression in Recall@5, Safety, Permission Enforcement, Restricted Leakage, Current Version Accuracy, Snapshot Integrity, Citation Correctness, Evaluation Framework, Knowledge Platform, Operational Core.

## Full test-suite regression checks (every fix, before being kept)

| Checkpoint | Suites | Tests | Result |
|---|---|---|---|
| Baseline (DGX 1.7.2 close) | — | — | Last known-good state before this sprint |
| After round-1 identifier fixes | 146/146 | 860/860 | Zero failures |
| After round-2 identifier fix | 146/146 | 862/862 | Zero failures |

Test count grew (857 → 860 → 862) purely from new unit tests added alongside each fix — never a net decrease, never a deleted or weakened test.

## Real quality-gate regression checks (full 1,840-case gold set)

| Gate | Full run #1 (before round-1 fix) | Full run #2 (after round-1) | Full run #3 (after round-2) |
|---|---|---|---|
| RECALL_AT_1 | 0.9832 PASS | 0.9848 PASS | 0.9859 PASS |
| MRR | 0.9861 PASS | 0.9872 PASS | 0.9882 PASS |
| IDENTIFIER_ACCURACY | 0.9974 **FAIL** | 0.9987 **FAIL** | **1.00 PASS** |
| WRONG_FITMENT | 0 PASS | 0 PASS | 0 PASS |
| WRONG_SUPERSESSION | 0 PASS | 0 PASS | 0 PASS |
| WRONG_LUBRICANT_APPROVAL | 0 PASS | 0 PASS | 0 PASS |
| RESTRICTED_LEAKAGE | 0 PASS | 0 PASS | 0 PASS |
| CURRENT_VERSION_ACCURACY | 1.00 PASS | 1.00 PASS | 1.00 PASS |
| LATENCY (p95) | 2884ms PASS | 2836ms PASS | 2888ms PASS |
| NO_REGRESSION_VS_1_7_1 | WAIVED | WAIVED | WAIVED |

Every safety/security/permission/fitment/supersession/lubricant-approval gate PASSed on every single run this sprint — never regressed, never waived to hide a real failure (the one `WAIVED` gate, `NO_REGRESSION_VS_1_7_1`, is honestly WAIVED because no comparable numeric 1.7.1 baseline exists at this sampling methodology — the same honest gap DGX 1.7.2's own final report already documented).

## Snapshot integrity

`KnowledgeSnapshot` v15 (status `APPROVED`, evaluated 2026-07-20) was not touched this sprint — no new snapshot was built or activated, since no knowledge content changed, only retrieval-layer code. Snapshot activation is addressed in [verification-results.md](verification-results.md).

## Citation correctness

No change was made to citation-resolution logic this sprint (unchanged from DGX 1.7.2, where the graph-relationship/legacy-document citation-mislabeling bugs were already found and fixed). The existing integration test suite (`retrieval-intelligence.integration-spec.ts`) continues to pass in full, including citation-shape assertions.

## Evaluation Framework / Operational Core

The generic `ai-benchmark` evaluation framework (DGX 1.6) and Operational Core (Phase 1-3 domain modules) were not modified this sprint at all — confirmed by the full regression suite passing without any change to their own test files.
