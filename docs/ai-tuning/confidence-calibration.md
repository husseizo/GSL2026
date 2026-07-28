# Confidence Calibration

## Metrics implemented

`src/catalogue-ai/evaluation/calibration-metrics.ts` — pure functions, no DB, no model calls:

- **`reliabilityDiagram(samples)`** — groups real samples by confidence band and computes each band's observed accuracy (fraction of samples in that band that were actually correct) against an assumed real point-probability for that band.
- **`expectedCalibrationError(samples)`** — weighted-average absolute gap between predicted probability and observed accuracy across bands.
- **`brierScore(samples)`** — mean squared error between predicted probability and the real binary outcome.

`CONFIDENCE_BAND_PROBABILITY` maps each catalogue confidence band to a rough anchor point-probability (`VERIFIED: 0.99, HIGH: 0.85, MEDIUM: 0.65, LOW: 0.4, CONFLICTING: 0.3, INSUFFICIENT_EVIDENCE: 0.1`) — **explicitly not a trained calibration curve**. A real calibration curve needs far more labeled outcome data (real query → real correct/incorrect judgment, at scale) than exists in this environment; these anchors are a documented starting assumption, not a fitted model.

## Honest scope of this phase's calibration work

No large-scale, real, human-labeled correctness dataset exists to calibrate against — the offline evaluation dataset's self-consistency cases give a real correctness signal for *exact-identifier* retrieval (which is already near-100% and near-certain), but not for the *generative* answers where calibration actually matters most. `scripts/verify-dgx-prototype-1-5.ts` runs the reliability/ECE/Brier functions against a small, honestly-labeled real sample derived from this phase's own evaluation run (see that script's "Confidence calibration (supplementary, real sample)" section) — this demonstrates the metric functions work correctly against real data, not that a calibration curve now exists.

## The real confidence-model fix this phase made (which calibration exists to check)

The most consequential real confidence-related change this phase — fixing the bug where a candidate's own approval/confidence metadata was used as a proxy for query relevance (see [retrieval-optimization.md](retrieval-optimization.md)) — is exactly the kind of error a real calibration exercise, done at scale, would have caught systematically rather than via one integration test's assertion. This is noted as motivation for prioritizing a real calibration dataset in a future phase, not claimed as already built.

## Confidence bands, unchanged

`VERIFIED`, `HIGH`, `MEDIUM`, `LOW`, `CONFLICTING`, `INSUFFICIENT_EVIDENCE` — the same six bands from Prototype 1's `confidence-model.ts`, unmodified. The generative path's confidence computation (`catalogue-rag.service.ts`) was rewritten (see [retrieval-optimization.md](retrieval-optimization.md)) but still maps onto these same six labels — no new band was added, and `computeCatalogueConfidence()` itself (used by the deterministic path) is unchanged.
