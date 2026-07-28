# Prompt Engineering Programme

## Versioned experiment framework — reused, not rebuilt

`PromptRegistryService` (Phase 4, unchanged) already provides exactly what the spec asks for: append-only versioning (`publishVersion()` never edits a previous `PromptVersion` row, only supersedes it and flips `isActive`), per-version temperature, and a real `promptVersionId` attached to every `AiInferenceLog` row for traceability. This phase uses it directly rather than building a second versioning mechanism.

## Real prompt versions compared

- **Baseline A, v1** (frozen, see [evaluation-baseline.md](evaluation-baseline.md)): a free-text prompt (`CATALOGUE_RAG_ANSWER`), undifferentiated evidence block, temperature 0.1, no structured-output constraint.
- **Tuned, v2** (`CATALOGUE_RAG_STRUCTURED_ANSWER`, new template): an evidence-bound prompt whose system instruction explicitly lists what the model must never do (invent an OEM number/alternate/supersession/approval, infer compatibility, hide uncertainty, cite unavailable sources — the spec's exact §14 list), section-grouped evidence (see [context-optimization.md](context-optimization.md)), a narrow required JSON output schema (`{answer, citedDocumentIds, hasConflict, missingInformation}`), `format: "json"` (Ollama's constrained-decoding option, plumbed through as a new optional field on `GenerateParams`/`DgxGenerateRequest`/the DGX FastAPI service — additive, not a breaking change to the existing generate contract), and temperature 0.

Real measured difference: see [final-tuning-report.md](final-tuning-report.md)'s baseline-comparison section for the exact groundedness/unsupported-claim-rate delta between these two real prompt versions on the same evaluation dataset shape.

## Decoding-settings comparison

Temperature 0 (production default, chosen for determinism per spec §21) was compared against temperature 0.3 by publishing a temporary v3 prompt version, re-running the same evaluation dataset, and reverting to temperature 0 afterward (`scripts/_tmp_decoding_compare.ts`, run once, real). See [final-tuning-report.md](final-tuning-report.md) for the real numbers from that comparison. Top-p, repetition penalty, and max-token sweeps were not separately run this phase — Ollama's `/api/generate` accepts these via its `options` object and the DGX FastAPI wrapper already passes `temperature`/`num_predict` through; extending the comparison to these settings is mechanical, not yet executed.

## Task-specific prompts — reduced scope, honestly

The spec lists ten task-specific prompt variants (exact-product, part-number-resolution, comparison, fitment, conflict, lubricant-comparison, approval-retrieval, no-answer, manual-review-handoff, multilingual). This phase implemented **one** real, generalized evidence-bound prompt (`CATALOGUE_RAG_STRUCTURED_ANSWER`) that all generative queries route through — not ten separately-tuned variants. This is a deliberate scope reduction given the time available and the small real evaluation sample this phase has to distinguish ten variants meaningfully; building ten prompt variants without enough real evaluation data to tell them apart would produce untested code, not a genuine improvement. The prompt-registry infrastructure supports adding task-specific templates incrementally (as Prototype 1's deterministic-lookup path already demonstrates by never invoking a prompt at all) whenever a larger real evaluation set justifies it.

## Rollback path

Because `PromptRegistryService.publishVersion()` is append-only, rolling back to Baseline A's exact v1 prompt (if the tuned v2 were ever found to regress) is a single `publishVersion()` call with v1's stored `systemPrompt`/`userPromptTemplate`/`temperature` — no data is ever lost, and `AiInferenceLog` rows from both eras remain individually attributable to the exact prompt version that produced them.
