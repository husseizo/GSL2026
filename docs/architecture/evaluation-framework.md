# Evaluation Framework

Measures what the spec's §17 asks for, using real mechanisms already wired elsewhere in Phase 4 rather than building a second, parallel measurement pipeline.

## Retrieval precision / recall — real, offline, measured

`src/ai-evaluation/ai-evaluation.service.ts`'s `runRetrievalEvaluation()` runs every case in an `EvaluationDataset` (purpose `RETRIEVAL`) through the real `RagService.answer()` — not a mock — and compares the documents it actually retrieved against a human-curated `expectedDocumentIds` set per case. Precision = true positives / retrieved count; recall = true positives / expected count. Verified end-to-end in `ai-evaluation.integration-spec.ts`: a real document is ingested and approved, a real query is run against it through real embeddings and real cosine similarity, and the measured recall is asserted to be positive — i.e. the evaluation genuinely exercises retrieval, it doesn't assume the answer.

## Forecast accuracy — not duplicated here

MAPE/RMSE/MAE/bias are already computed and persisted per `ForecastRun` by `ForecastingService`'s own backtesting (see [forecasting.md](forecasting.md)). Building a second evaluation pipeline to re-measure the same numbers would be exactly the kind of duplication the project's principles rule out — `AiEvaluationService` is scoped to retrieval, where no other module already measures accuracy.

## Recommendation / technician / purchase acceptance

`AiFeedbackService.acceptanceRate()` (see [ai-governance.md](ai-governance.md)) — one implementation, filterable by `AiInferenceKind`, reused across every assistant rather than one acceptance-tracker per assistant.

## Hallucination monitoring — a real, if intentionally modest, signal

`src/rag/grounding-score.ts`'s `computeGroundingScore()` measures lexical overlap between a generated answer's vocabulary and the retrieved source chunks' vocabulary (Jaccard-style, stopwords excluded). This is **explicitly a proxy, not a semantic entailment check** — a true "does this claim actually follow from the evidence" check would need a second LLM call, which is its own hallucination risk. A low grounding score (< 0.3) doesn't prove a fabricated fact, but it does mean the model said a lot that isn't traceable to any retrieved word, which is worth a human's attention — `RagAnswer.groundingScore` is returned on every `/ai/chat` response, and a low score adds an explicit note to `missingInformation`. Unit tested directly: a genuinely grounded answer scores > 0.7 against its real source; an answer about "the spaceship warp core" against an ignition-coil source scores < 0.3.

## Latency and GPU utilization

`AiInferenceLog.latencyMs` is recorded on every real call (median ~1s for embeddings, several seconds for generation on this CPU-only sandbox, measured directly in `ai-gateway.integration-spec.ts`). GPU utilization is whatever `/v1/health`'s real `nvidia-smi` probe reports — `gpuAvailable: false` here, real device utilization percentages on an actual DGX Spark, never fabricated in either case.

## Deliberately not built

Offline A/B testing infrastructure beyond comparing two `EvaluationRun`s' metrics side by side (see [ai-governance.md](ai-governance.md)), and forecast/recommendation customer-outcome tracking (would require real longitudinal business outcome data this system doesn't yet have at volume) — flagged here rather than silently omitted.
