# AI Foundation Certification Sprint — Ranking Experiments

Spec §8/§9/§14: benchmark ranking signal weights and hybrid-retrieval configurations scientifically, never assume improvement, and keep a real Retrieval Laboratory record even of rejected configurations.

## Honest result: no ranking-weight experiment was run this sprint

The sprint's plan (step 4) reserved `RetrievalLabService.compareStrategies()` for evidence-based tuning of `DEFAULT_SIGNAL_WEIGHTS`/`BM25_K1`/`BM25_B` **if the identifier-classification fixes left a residual gap**. They did not: once the real classification and candidate-generation bugs documented in [identifier-analysis.md](identifier-analysis.md) were fixed, all 10 mandatory gates passed on the full 1,840-case gold set without any ranking-weight change.

This is reported plainly rather than manufacturing an experiment to satisfy a checklist — the sprint's own rule is "every optimization must be evidence-based," and there was no real evidence this sprint that a ranking-weight change was needed. Running speculative weight sweeps against a dataset that already passes every gate would not produce a genuine "before/after" comparison; it would just be noise search.

## What this confirms about the existing ranking engine

The 15-signal weighted scoring in `ranking-engine.ts` (`EXACT_IDENTIFIER` weight 100 dominating all other signals combined, ~40) was already correctly calibrated for the sprint's priority order (Identifier Accuracy > Recall@1 > MRR > Precision@1 > nDCG > Recall@3 > Recall@5 > Latency) — the gap this sprint closed was entirely upstream of ranking, in whether the right candidates ever reached the ranking stage at all.

## Retrieval Laboratory infrastructure status

`RetrievalLabService` (built in DGX 1.7.2) remains fully available, unmodified, and real — `compareStrategies()` and `replayQuery()` both work against the live pipeline (confirmed via the existing integration test `real Query Lab replay re-runs a real logged query through the live pipeline and produces a real result`). It is simply not the mechanism that closed this sprint's gap.

## What would justify a future ranking experiment

If a future certification cycle finds a real gate failing *after* identifier/candidate-generation correctness is confirmed (e.g., a genuine Recall@3/Recall@5 shortfall on semantic-search-dependent categories), that would be the evidence trigger for a real `compareStrategies()` run — recorded with Experiment ID, Configuration, Metrics Before/After, Regression Status, Decision, and Rollback Target, per spec §14. No such trigger existed this sprint.
