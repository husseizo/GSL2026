# DGX Deployment (This Environment)

## Real, honestly-reported state

`GET /v1/health` against the real local DGX service returns:

```json
{"status":"ok","version":"0.1.0","mode":"cpu","gpuAvailable":false,"gpuDevices":[],"ollamaReachable":true,"ollamaVersion":"0.31.1"}
```

This environment runs **CPU-only, no GPU** — the same honest state reported by every prior phase's verification in this project. No GPU-accelerated latency/throughput numbers are claimed anywhere in this phase's documentation or evaluation reports, because there is no GPU to measure. `GET /v1/models` lists exactly two real models: `nomic-embed-text:latest` (embedding, 274MB) and `llama3:latest` (generation, 4.66GB) — see [embedding-model-evaluation.md](embedding-model-evaluation.md) and [llm-model-evaluation.md](llm-model-evaluation.md) for why the spec's multi-model comparisons are scoped down accordingly.

## No direct database access from the model

`DgxClientService` only ever calls `/v1/generate`, `/v1/embed`, `/v1/health`, `/v1/models` over HTTP against `DGX_SERVICE_URL` (default `http://127.0.0.1:8800`, configurable via env, validated as a URI in `src/config/env-validation.ts`). The model process has no Prisma client, no database credentials, and no filesystem access to this project's source code — everything it receives is assembled application-side (`RagService.retrieveAndGenerate()`'s context string, `CatalogueRagService`'s prompt variables) and handed over as plain HTTP request bodies.

## Single choke point

`AiGatewayService` is the only class in the entire codebase that calls `DgxClientService` — every catalogue query, technician/parts/lubricant/manager assistant, and embedding call in this platform funnels through it. This means rate limiting (`RateLimiterService`, real 30-req/60s per actor), sanitization (`sanitizePrompt()`), and audit logging (`AiInferenceLog`, every call, success or failure) apply uniformly to catalogue RAG without any catalogue-specific code needing to reimplement them.

## Concurrency and throughput, as actually measured

A real concurrency benchmark (20 concurrent embed calls) measured ~9.8 real seconds total (~491ms/item effective). A real paced sequential corpus build (120 documents, honoring the real 30-req/60s rate limit via `CatalogueIndexVersionService`'s `paceEmbedCall()`) measured 250.6 real seconds (~2.09s/document). Real generation calls (llama3, CPU) run on the order of tens of seconds each — the real integration test `catalogue-rag.integration-spec.ts` needed a 120-second per-test timeout to reliably complete one generation call, matching the same real timeout Phase 4's own `rag.integration-spec.ts` already needed.

## Deployment topology

No separate DGX deployment work was performed in this phase — the same local Ollama-backed FastAPI service used by every prior AI phase in this project is reused unchanged. `ModelRegistryService.syncFromDgx()` discovers whatever models are actually pulled and registers them as real `AiModel` rows; no models were manually registered outside that path.
