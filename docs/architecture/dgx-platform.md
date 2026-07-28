# Phase 4 — DGX AI Platform, Automotive Intelligence & Decision Engine

Builds on [Phase 1](00-overview.md), [Phase 2](phase-2-commercial-foundation.md), and [Phase 3](garage-architecture.md) without modifying any of them. Phase 4 adds a bounded, independent AI/Intelligence layer on top of the operational core — the Operational Core remains the sole system of record for every transaction; DGX Spark only returns recommendations, predictions, explanations, and confidence, never writing to a transactional table directly.

## Reality check: what actually runs where in this environment

This sandbox has **no GPU** (`nvidia-smi` not found) and **no pgvector extension** on the local portable PostgreSQL 16 build. Rather than fabricate either, Phase 4 was built around what genuinely exists and is verifiable:

- **Ollama** (`0.31.1`) was already installed and running locally, with two real pulled models: `llama3:latest` (4.7 GB, generation) and `nomic-embed-text:latest` (274 MB, embeddings). Every "AI" response in this system's tests and verification run is produced by these real models running on CPU — not mocked, not fabricated.
- **Ollama is also NVIDIA's own recommended way to run local models on a real DGX Spark** — same binary, same REST API, GPU-accelerated automatically when CUDA is present. This is precisely why it was chosen: the code in `services/dgx-ai-platform/` and `AiGatewayService`/`DgxClientService` needs zero changes to run on a real DGX Spark — only `OLLAMA_BASE_URL` changes, and `/v1/health`'s honest GPU detection (`nvidia-smi`) will start reporting real GPU devices instead of `gpuAvailable: false`.
- No pgvector/Qdrant/Milvus exists here, so vector search runs on an in-application cosine-similarity backend over a plain Postgres `Float[]` column — see [vector-search.md](vector-search.md) for the swap-later interface this sits behind.

## Architecture

```
Operational Core (NestJS)
  │
  ▼
AI Gateway (src/ai-gateway/) — sanitization, rate limiting, per-inference logging
  │
  ▼
DgxClientService — HTTP client, the ONLY thing allowed to call the DGX boundary
  │
  ▼
services/dgx-ai-platform (Python/FastAPI) — /v1/generate, /v1/embed, /v1/models, /v1/health
  │
  ▼
Ollama — llama3 (generation), nomic-embed-text (embeddings)
```

Everything above the FastAPI boundary is NestJS, reusing Phase 1-3's Prisma models, RBAC guards, and controller conventions. Everything at or below the FastAPI boundary has **no database driver, no ORM, no connection string in its dependency tree** — it cannot write to a transactional table even by mistake, because it has no way to reach one. `services/dgx-ai-platform/app/main.py`'s own header comment states this structural guarantee explicitly.

## Modules delivered

| Spec's module | Implementation |
|---|---|
| AI Gateway | `src/ai-gateway/` — `AiGatewayService`, `DgxClientService`, `RateLimiterService`, `prompt-sanitizer.ts` |
| Model Registry | `src/model-registry/` — see [model-registry.md](model-registry.md) |
| Inference Service | `services/dgx-ai-platform/app/main.py` `/v1/generate` |
| Embedding Service | `src/embeddings/` + `services/dgx-ai-platform` `/v1/embed` |
| Vector Search | `src/vector-search/` — see [vector-search.md](vector-search.md) |
| Knowledge Base | `src/knowledge-base/` — see [rag-architecture.md](rag-architecture.md) |
| Evaluation Engine | `src/ai-evaluation/` — see [evaluation-framework.md](evaluation-framework.md) |
| Prompt Registry | `src/prompt-registry/` — see [prompt-registry.md](prompt-registry.md) |
| Feedback Engine | `src/ai-feedback/` — see [ai-governance.md](ai-governance.md) |
| GPU Health Monitor | `services/dgx-ai-platform` `/v1/health`, exposed via `GET /ai/model-registry/gpu-health` |
| Model Deployment Manager | `ModelRegistryService.syncFromDgx()` — reflects real Ollama models into the registry |

Digital Twin Intelligence, Forecasting, intelligent purchasing, and the four AI assistants are documented separately: [digital-twin-intelligence.md](digital-twin-intelligence.md), [forecasting.md](forecasting.md), and the assistant sections of [rag-architecture.md](rag-architecture.md).

## Version information and inference logging

Every `AiModel` row carries `provider`/`family`/`version`/`quantization`/`sizeBytes`/`status` — real values synced from Ollama's `/api/tags`, never hand-typed placeholders. Every call through `AiGatewayService.generate()`/`.embed()` writes an `AiInferenceLog` row — model, prompt (truncated to 4000 chars), response, temperature, tokens in/out, latency, confidence, retrieved document IDs, success/failure — whether the call succeeded or not. This is structural, not optional: there is no code path through `AiGatewayService` that skips logging.

## Local LLM infrastructure

Ollama supports every model family the spec names (Llama, Qwen, DeepSeek, Mistral, Gemma, Phi) via `ollama pull <name>`; only `llama3` and `nomic-embed-text` are actually pulled in this environment. Model switching is a `DGX_SERVICE_URL`-side concern (which model tag a request names) — `AiGatewayService.generate({model: 'qwen2.5:...'})` would work today if that tag were pulled, without any code change, because the DGX service's `/v1/generate` passes `model` straight through to Ollama. `AiModel.isDefault` picks the fallback model when a caller doesn't specify one; switching the default is `ModelRegistryService.setDefault()`, an API call, not a deploy.

## Running the DGX service locally

```bash
cd services/dgx-ai-platform
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8800   # port 8000 is Windows-reserved on this box
```

`operational-core`'s `DgxClientService` defaults to `http://127.0.0.1:8800`; override with `DGX_SERVICE_URL`. See [security-dgx.md](security-dgx.md) for isolation/sandboxing details and [../../services/operational-core/README.md](../../services/operational-core/README.md) for the full verification walkthrough.
