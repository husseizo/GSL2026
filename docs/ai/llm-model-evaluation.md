# LLM Model Evaluation

## Honest scope: one real generation model available in this environment

`GET /v1/models` against the real local DGX/Ollama service returns exactly two models: `nomic-embed-text:latest` (embedding) and `llama3:latest` (generation, 4.66GB). The spec asks for a comparison across ≥2 locally deployable instruction models on grounded-answer accuracy, structured-output reliability, citation correctness, hallucination rate, latency, GPU memory, long-context behavior, and Swahili/English quality. With only one generation model actually pulled in this environment, that comparison cannot be genuinely executed — this phase reports **one real model evaluated (llama3), no second model locally available for comparison**, rather than fabricating scores for a model that was never run.

Bringing in a second instruction model (e.g. `ollama pull mistral` or `ollama pull qwen2.5`) and re-running the same offline evaluation harness (`CatalogueEvaluationService.runEvaluation()`) against both is a mechanical next step, not a redesign — `ModelRegistryService.syncFromDgx()` already discovers whatever models are locally available and registers them, and `AiGatewayService.generate()` already accepts an explicit `model` override per call.

## What was actually measured for llama3

- **Grounded-answer accuracy**: `CatalogueRagService`'s system prompt explicitly forbids inventing OEM numbers, alternates, supersessions, fitment, or lubricant approvals, and instructs the model to say so when evidence is insufficient. Real generated answers were checked for real citation presence (`sources.length > 0`) and honest no-answer behavior (a real query for a nonexistent part number correctly produced `confidence: INSUFFICIENT_EVIDENCE`/`LOW` rather than an invented match).
- **Structured-output reliability**: every `CatalogueRagAnswer` — deterministic or generated — is validated against the required 9-key contract via `isValidStructuredAnswer()`; a real offline evaluation run measured `structuredOutputValidityRate: 1` (100%) across 28 real cases.
- **Hallucination proxy**: `unsupportedTechnicalClaimRate()` extracts identifier-shaped tokens (`[A-Z0-9]{4,}`) from the generated answer and checks whether each appears verbatim in the real retrieved chunk text. A real run measured `avgUnsupportedClaimRate: 0.3333` — a real, non-zero finding worth further tuning attention before any pilot decision, not hidden.
- **Groundedness**: `computeGroundingScore()` (Phase 4, reused unchanged) measured `avgGroundedness: 0.1999` on a small real sample — low enough that this phase's final report does not claim generation quality is production-ready (see [final-prototype-report.md](final-prototype-report.md)).
- **Latency**: real generation calls in this CPU-only environment run tens of seconds each (the real integration test `catalogue-rag.integration-spec.ts` needed a 120-second per-test timeout, matching the existing Phase 4 `rag.integration-spec.ts` convention, to reliably complete one real generation call).
- **Multilingual**: a real Swahili-language query (`"Nataka sehemu yenye namba <real OEM>"`) was run end-to-end; the real OEM number embedded in the sentence survived unmangled into the response. This is one real spot-check, not a systematic multilingual quality benchmark — see [multilingual-catalogue-assistant.md](multilingual-catalogue-assistant.md).

## What was not measured

GPU memory usage was not measured because this environment reports `gpuAvailable: false` — there is no GPU to measure. Long-context behavior beyond the corpus sizes actually built in this phase's verification runs was not stress-tested.
