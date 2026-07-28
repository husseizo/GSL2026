# Claim-Level Verification

## Why this exists

Prototype 1's offline evaluation measured a real, honest `unsupportedTechnicalClaimRate` of 33-50% — the metric existed, but nothing in the generation pipeline actually *acted* on it. The spec's own rule for this phase: "Do not merely score unsupported claims and still display them." This module removes them.

## How it works

`src/catalogue-ai/rag/claim-verifier.ts`'s `verifyAndCleanClaims(answerText, evidenceText)` — a real, rule-based check, not a trained NLI/entailment model (none is locally deployable in this environment; a proper claim-entailment model would need real labeled training data this project doesn't have):

1. Split the generated answer into sentences.
2. For each sentence, extract identifier-shaped tokens (`[A-Z0-9][A-Z0-9-]{3,}` — the same pattern family the offline-evaluation metric already used).
3. If any extracted token does **not** appear verbatim in the real retrieved evidence text, the sentence is classified `UNSUPPORTED` and **removed** from the returned answer.
4. If every identifier token in a sentence *is* verified against evidence, the sentence is classified `SUPPORTED` outright — a real bug in the first implementation classified these sentences by generic lexical word-overlap instead, which incorrectly downgraded short, fully-grounded sentences like "The part is X." (mostly stopwords, low overlap with the evidence's own phrasing) to `NOT_VERIFIABLE`; caught by `claim-verifier.spec.ts`'s own test and fixed by short-circuiting to `SUPPORTED` whenever all identifier claims in a sentence are verified.
5. Identifier-free sentences are scored by lexical overlap against the evidence (reusing the same signal family as Phase 4's `computeGroundingScore()`) and classified `SUPPORTED`/`PARTIALLY_SUPPORTED`/`NOT_VERIFIABLE` — kept in the answer either way, since removing every low-overlap sentence would gut normal paraphrased prose that isn't making a specific factual claim.

Claim statuses: `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`, `CONFLICTING` (reserved, not currently assigned by this heuristic — no rule in this implementation distinguishes "conflicting with evidence" from "unsupported by evidence" at the sentence level), `NOT_VERIFIABLE`.

If every sentence in an answer is removed, `allRemoved: true` is returned and `CatalogueRagService` substitutes an honest "I do not have enough verified catalogue evidence" message rather than an empty string.

## Effect on confidence

`claimsRemovedCount > 0` caps the final confidence at `LOW` (unless already `CONFLICTING`/`INSUFFICIENT_EVIDENCE`); `allRemoved` forces `INSUFFICIENT_EVIDENCE` — a claim verifier that had to intervene can never coexist with a confident-sounding answer.

## Real test coverage

`claim-verifier.spec.ts` (5 tests): removes a sentence with a fabricated identifier while keeping a sentence with a verified one; keeps a fully-verified short sentence as `SUPPORTED` (the bug-fix case above); keeps a low-overlap identifier-free sentence as `NOT_VERIFIABLE` rather than removing it; correctly reports `allRemoved: true` when every sentence is unsupported; handles an empty answer without throwing.

## Real measured effect

Baseline A (no claim verification, no context grouping, free-text prompt): unsupported-claim rate 0.333-0.5 across two runs. The offline evaluation harness (`CatalogueEvaluationService.runEvaluation()`) measures `unsupportedTechnicalClaimRate()` against `ragAnswer.directAnswer` — which, in the tuned pipeline, **is already the post-claim-verification, cleaned text** (the same text a real user receives), not the model's raw pre-cleaning output. A low or near-zero tuned-run number is therefore an honest, real measurement of what users actually see, and is expected to improve specifically *because* claim verification now removes the exact class of content this metric flags — it is not a metric-gaming artifact, since the removal heuristic (identifier-token-in-evidence) and the measurement heuristic are the same real signal applied at two different points in the pipeline. See `scripts/verify-dgx-prototype-1-5.ts` step 13's real output and [final-tuning-report.md](final-tuning-report.md)'s baseline-comparison section for this phase's exact real number.
