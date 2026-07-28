# DGX Prototype 1.5 — AI Evaluation, Prompt Engineering, Retrieval Optimization and Safety Tuning

## What this phase is and isn't

Prototype 1 (Automotive Catalogue RAG) was accepted as **NEEDS_TUNING** — the deterministic search and safety architecture were judged strong enough for a narrow internal pilot on their own; the generative layer's real, measured groundedness (0.18-0.20) and unsupported-claim rate (33-50%, against a <2% target) did not clear acceptance thresholds. This phase's entire purpose is closing that specific gap: turning the generative layer from an unreliable explanation into a controlled, evidence-bound assistant.

This is explicitly **not** a new feature phase. No new catalogue modules, portals, assistants, business workflows, predictive models, or AI-driven writes were added. Everything below is evaluation, prompt engineering, retrieval optimization, claim verification, safety hardening, or a security hotfix.

## What changed

- **Security hotfix** (blocking, done first): `POST /auth/register` no longer leaks `passwordHash`/`mfaSecretEncrypted`; a related leak in `ApiKeysService` (raw `keyHash` in create/list/revoke responses) and in `requestEmailVerification` (raw verification token returned in-band) were found during the same audit and fixed. See [security-hotfix.md](security-hotfix.md).
- **Baseline A frozen** before any tuning change — corpus/index/model/prompt versions and real pre-tuning metrics recorded in [evaluation-baseline.md](evaluation-baseline.md).
- **`CatalogueRagService` rewritten** to compose `AiGatewayService`/`VectorSearchService`/`PromptRegistryService` directly instead of one opaque `RagService.retrieveAndGenerate()` call, so retrieval can be decomposed into real, inspectable stages. See [retrieval-optimization.md](retrieval-optimization.md).
- **Context construction**: retrieved candidates are now grouped into labeled evidence sections (verified facts / candidate matches / lubricant evidence / conflict evidence) instead of one undifferentiated block, with configurable context-size minimization. See [context-optimization.md](context-optimization.md).
- **Evidence-bound generation**: a narrow, JSON-constrained (`format: "json"`, an additive change to the DGX FastAPI service) prompt asks the model only for an answer, cited document ids, a conflict flag, and missing-information — never the full complex schema, which is assembled by real application code from the real retrieved data instead.
- **Claim-level verification**: every generated answer is split into sentences and checked against the real retrieved evidence text; sentences referencing an identifier absent from evidence are removed from the returned answer, not merely flagged. See [claim-verification.md](claim-verification.md).
- **Citation validation**, **confidence recalibration** (fixed a real bug where a candidate's own verification metadata was wrongly used as a proxy for query relevance), **expanded query router** (VIN, prompt-injection, unsupported-diagnostic detection with fixed safe refusals), **expanded offline evaluation dataset** with ground-truth governance, **reranker evaluation**, **shadow-mode pilot controls**, and **new Prometheus metrics** — see the respective docs linked from [final-tuning-report.md](final-tuning-report.md).

## What is honestly out of reach in this environment

Only one embedding model (`nomic-embed-text`) and one generation model (`llama3`) are locally available — the spec's multi-model comparisons are scoped to what's actually installed, not fabricated. No cross-encoder reranker model is available locally. A full, unscoped platform-wide integration-test run could not be completed cleanly in this session (see [decision-log.md](decision-log.md) for why) — the catalogue-ai-scoped suite (this phase's actual code) was run to completion instead, repeatedly, successfully.

## Readiness decision

See [final-tuning-report.md](final-tuning-report.md) for the evidence-based verdict: **PILOT_READY**, **NEEDS_MORE_TUNING**, or **NOT_READY**. This phase does not declare PRODUCTION_READY, per the spec's own instruction.
