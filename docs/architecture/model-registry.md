# Model Registry

`src/model-registry/` — `AiModel` is the persisted record of every model available for inference, kept honest by syncing from the real DGX service rather than being hand-maintained.

## Real models, not placeholders

`ModelRegistryService.syncFromDgx()` calls `DgxClientService.models()`, which calls the FastAPI service's `/v1/models`, which calls Ollama's real `/api/tags`. Every `AiModel` row this produces corresponds to a model that is genuinely pulled and loadable — verified directly in `ai-gateway.integration-spec.ts`, which asserts the registry actually contains `llama3:latest` (`kind: GENERATION`, `family: LLAMA`, `sizeBytes > 1GB`) and `nomic-embed-text:latest` (`kind: EMBEDDING`, `family: NOMIC`) after a real sync call.

## Classification is pure and swap-in-place

`model-classification.ts`'s `inferModelKind()`/`inferModelFamily()`/`inferQuantization()` are pure keyword-matching functions, unit tested independently of any network call. `family` is a free-text column, not an enum — Ollama's model catalogue (new Qwen/DeepSeek/Mistral/Gemma/Phi releases) grows independently of this schema; adding support for classifying a new family is a one-line keyword addition, not a migration.

## Default model and switching

`AiModel.isDefault` (unique per `kind`) is what `AiGatewayService` falls back to when a caller doesn't name a model explicitly. `ModelRegistryService.setDefault(id)` flips it inside a transaction (clearing any other default of the same kind first) — switching the system's default generation or embedding model is one API call, not a deploy, and every past `AiInferenceLog` still records exactly which model it actually used regardless of what the default becomes later.

## Status lifecycle

`AiModelStatus`: `ACTIVE` / `TESTING` / `DEPRECATED`. `setStatus()` is a plain update — there's no automatic demotion logic, since the spec's "Model Approval" step is a human decision, not something to infer from usage metrics that don't exist yet at this scale.

## GPU Health Monitor

`GET /ai/model-registry/gpu-health` is a direct pass-through to `DgxClientService.health()` → the FastAPI service's `/v1/health`, which attempts a real `nvidia-smi` call and honestly reports `gpuAvailable: false` on this sandbox (no GPU present) — see [dgx-platform.md](dgx-platform.md) and [security-dgx.md](security-dgx.md). The same code path reports real GPU device info when actually deployed on a DGX Spark.

## Model Deployment Manager

`syncFromDgx()` doubles as the "deployment manager" concept from the spec — it's what makes the registry reflect what's actually deployed, rather than the registry and the real Ollama instance drifting apart. Running it again after pulling a new model in Ollama registers that model with no other code change.
