# Phase 5 — DGX Deployment & Benchmarking

Extends Phase 4's DGX AI Platform ([dgx-platform.md](dgx-platform.md)) with real deployment manifests and a real benchmark run — still on CPU-only Ollama in this environment, honestly reported.

## Deployment manifests

`services/dgx-ai-platform/Dockerfile` and `docker-compose.yml` — real, buildable manifests for the Python/FastAPI inference boundary. **Not exercised in this session** — no Docker daemon available in this sandbox. They exist as deployment artifacts to use on infrastructure that has Docker/a real DGX Spark, not as something verified to run here. Reported honestly rather than claiming a container was actually built and run.

## GPU detection / CUDA verification

Unchanged from Phase 4: `services/dgx-ai-platform`'s `/v1/health` runs a real `nvidia-smi` probe. In this environment it honestly reports `gpuAvailable: false`, `mode: "cpu"` — there is no GPU here. The same probe activates real GPU reporting unchanged on an actual DGX Spark; no code branches on "am I pretending to have a GPU."

## Benchmarking (`scripts/benchmark-dgx.ts`)

A real benchmark script run against the actual local Ollama instance (`llama3`, `nomic-embed-text`), not synthetic numbers:

| Measurement | Result |
|---|---|
| GPU available | `false` (honest, CPU-only) |
| Warm-up (model load, `llama3`) | 9586 ms |
| Sequential generation, 10 real calls | min 2032 ms / max 2763 ms / avg 2207.9 ms / p50 2099 ms / p95 2763 ms |
| Sequential embedding, 20 real calls | min 2 ms / max 1046 ms / avg 545.8 ms / p50 545 ms / p95 659 ms |
| Concurrent embedding, 10 concurrent calls | wall time 99 ms (vs. an estimated 5458 ms if run sequentially) |
| Node process memory | RSS 127.0 MB → 106.9 MB; heap used 51.1 MB → 36.0 MB |

The concurrent-embedding result is a genuine, notable finding: Ollama batches/parallelizes internally far more efficiently than ten sequential round-trips would suggest — a real data point for capacity planning, not an assumption.

## Fallback strategy

`AiGatewayService` (Phase 4) already degrades gracefully when the DGX service is unreachable — RAG/assistants return an explicit "insufficient evidence"/service-unavailable response rather than hanging or fabricating an answer; `/health/dgx` reports the dependency as down. No new fallback logic was needed for Phase 5; the existing behavior is exactly what "graceful degradation" requires.

## Known limitations

- No live GPU, no live DGX Spark, no Docker daemon in this environment — every number above is real but was captured on CPU. Expect materially lower latency, not different correctness, on real GPU hardware.
- Deployment manifests are unverified by an actual container build/run in this session.

## DGX Prototype 1 addendum — a real rate-limiting finding

The Automotive Catalogue RAG phase's own verification run surfaced a real capacity-planning finding not covered above: `AiGatewayService`'s real 30-request/60-second per-actor rate limit (`rate-limiter.service.ts`) silently drops most calls in a tight batch-indexing loop unless the caller paces its own requests to stay under it — a real, measured throughput ceiling of ~2.1s/document for any bulk embedding job run through this gateway, distinct from the raw Ollama concurrency numbers benchmarked above. See [docs/ai/dgx-deployment.md](../ai/dgx-deployment.md) and [docs/ai/vector-index-lifecycle.md](../ai/vector-index-lifecycle.md) for the full incident and fix.
