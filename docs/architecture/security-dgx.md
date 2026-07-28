# AI Security

DGX Spark stays isolated from the transactional system by construction, not by policy — see the structural claims below, each backed by what's actually absent from the code rather than a promise about how it's used.

## No direct SQL execution, ever

`services/dgx-ai-platform` (the Python FastAPI boundary) has **no database driver anywhere in its dependency tree** (`requirements.txt`: `fastapi`, `uvicorn`, `httpx`, `pydantic` — nothing else). It cannot execute SQL, connect to Postgres, or read/write a transactional table even if the code tried to, because there is no client library present to do so with. This is verifiable by reading `requirements.txt` and `app/main.py` directly — it is not an access-control rule that could be misconfigured, it is an absent capability.

## No unrestricted filesystem access

`app/main.py` never opens, reads, or writes a file path derived from request input (or at all, beyond its own source). The only I/O it performs is HTTP calls to `OLLAMA_BASE_URL` and one `subprocess.run(["nvidia-smi", ...])` call with a fixed argument list (`_detect_gpu()`) — never a shell string built from user input, never `shell=True`.

## No direct internet inference

`OLLAMA_BASE_URL` defaults to `http://127.0.0.1:11434` — a local Ollama instance. The FastAPI service makes no calls to any external hosted inference API; every model it serves is one already pulled locally via `ollama pull`.

## No unrestricted prompt execution

Every prompt passes through `sanitizePrompt()` (`src/ai-gateway/prompt-sanitizer.ts`) before it ever reaches `AiGatewayService.generate()`'s call to the DGX boundary:

- **Control characters are stripped** (all C0 controls except tab/newline/carriage-return, plus DEL) — hard-enforced, always.
- **Length is capped at 8,000 characters** — hard-enforced, truncation is flagged (`truncated: true`) rather than silently applied.
- **Injection-pattern detection is flag-only, not blocking.** Patterns like "ignore all previous instructions," "you are now a...," "reveal the system prompt," "developer mode/jailbreak" are matched and recorded (`injectionRiskFlags`) but the call still proceeds. This is a deliberate trade-off, not an oversight: a genuine technician note ("ignore the dashboard warning light, it's always been on") would be a false-positive rejection under a hard block. Flags are visible on the response for review — the same "flag, don't silently block" philosophy Phase 2/3's `MANUAL_REVIEW` data-quality severity already established for this system. Verified directly: `prompt-sanitizer.spec.ts` asserts both that a real injection attempt is flagged and that a legitimate note containing "ignore" is not.

## Rate limiting

`RateLimiterService` (`src/ai-gateway/rate-limiter.service.ts`) — an in-memory sliding window, 30 requests per 60-second window per actor. Explicitly documented as a placeholder for a single-process deployment, not sufficient for a multi-instance one — the same class of scope limitation Phase 2/3 already documented for branch/warehouse RBAC scoping ([rbac-permissions.md](rbac-permissions.md)). A caller past the limit gets `{available: false, errorMessage: 'Rate limit exceeded'}` — never a thrown exception that could crash the surrounding request — and the rejection is itself logged as a failed `AiInferenceLog` row.

## Audit every inference

Covered fully in [ai-governance.md](ai-governance.md): there is no code path through `AiGatewayService` that skips writing an `AiInferenceLog` row, success or failure.

## Graceful degradation, not silent failure or a crash

`DgxClientService` wraps every call in a timeout (`AbortController`, 5s for health, 60s for embeddings, 180s for generation) and converts any network failure into a typed `DgxUnavailableError`. `AiGatewayService` catches this, logs the failure, and returns `{available: false}` — verified directly in `ai-gateway.integration-spec.ts` by pointing a gateway instance at an unreachable port and confirming it returns a clean failure result instead of throwing. Every caller (RAG, assistants) is built to handle `available: false` explicitly rather than assuming success.

## RBAC

Every `/ai/*` endpoint sits behind the same `PermissionsGuard`/`@RequirePermissions` used everywhere else in this system, with Phase 4's new `ai.*` permission set (`ai.chat`, `ai.vehicleHealth`, `ai.forecast.read`/`.generate`, `ai.recommend`, `ai.technicianAssistant`, `ai.managerAssistant`, `ai.modelRegistry.read`/`.manage`, `ai.prompts.read`/`.manage`, `ai.evaluations.read`/`.manage`, `ai.knowledgeBase.read`/`.manage`, `ai.feedback.manage`) granted additively to existing roles — no new auth mechanism, same header-based actor stand-in and its documented scope limitations (see [rbac-permissions.md](rbac-permissions.md)).
