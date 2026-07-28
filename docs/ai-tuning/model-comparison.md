# Model Comparison (Prototype 1.5 re-check)

## Honest, unchanged environment constraint

`GET /v1/models` still lists exactly one generation model, `llama3:latest` — the same single model available during Prototype 1. No second instruction model was pulled into this environment during this tuning phase. The spec's comparison across ≥2 locally-deployable instruction models remains genuinely out of reach here.

## What this phase measured for the one available model

The real, quantitative before/after comparison this phase *can* honestly make is not "model A vs. model B" but "llama3 with Baseline A's prompt/context/no-claim-verification vs. llama3 with the tuned prompt/context/claim-verification pipeline" — see [prompt-experiments.md](prompt-experiments.md) and [final-tuning-report.md](final-tuning-report.md) for those real numbers. This is a legitimate, real comparison; it is not the model comparison the spec describes, and is not presented as such.

## What a real second model would require, if pulled

Same mechanism as noted in [embedding-evaluation.md](embedding-evaluation.md): `ModelRegistryService.syncFromDgx()` auto-discovers whatever Ollama has pulled, and `AiGatewayService.generate({ model: '<name>' })` already accepts an explicit per-call model override. Adding a second model to compare is `ollama pull <model>` plus re-running `CatalogueEvaluationService.runEvaluation()` once per model — no code change required. Not executed this phase.

## Do not automatically choose the largest model

This principle from the spec is trivially satisfied by having no choice to make — llama3 (the only model available) was neither selected for being large nor small; it is simply what this environment has. When a second model becomes available, the same real evaluation harness (groundedness, unsupported-claim rate, citation correctness, structured-output validity, latency) should decide, not model size or reputation.
