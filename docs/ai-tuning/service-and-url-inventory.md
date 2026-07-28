# Service and URL Inventory — DGX Prototype 1.5

Real, directly-checked state as of this phase (2026-07-14), building on the Prototype 1 Final Acceptance Report's own inventory (`docs/ai/service-inventory.md`, `endpoint-inventory.md`, `swagger-inventory.md`) rather than duplicating it — only what changed or was re-verified is repeated here.

## Live services (re-confirmed this phase)

| Service | Host:Port | Base URL | Health | Auth | Environment | Status | Loopback/LAN/Public |
|---|---|---|---|---|---|---|---|
| Operational Core backend | 127.0.0.1:3900 | `http://127.0.0.1:3900` | `GET /health` — real `{db, redis, dgx}` all `ok` | Bearer JWT / `x-api-key` | Development | **Running** (same process from the Prototype 1 acceptance pass, hot-reloaded through this phase's code changes via `--watch`) | Loopback-only |
| DGX/Ollama inference | 127.0.0.1:8800 (proxying 127.0.0.1:11434) | `http://127.0.0.1:8800` | `GET /v1/health` | None (internal) | Development | **Running**, CPU-only | Loopback-only |
| PostgreSQL | 127.0.0.1:55432 | n/a | via `/health/db` | DB credentials | Development | **Running** | Loopback-only |
| Redis (Memurai) | 127.0.0.1:16379 | n/a | via `/health/redis` | Redis auth | Development | **Running** — now also backing `CatalogueSearchService.findByOemNumber()`'s real cache | Loopback-only |
| Web Management Portal | localhost:5174 / 5180 | `http://localhost:5174`, `http://localhost:5180` | n/a (SPA) | Browser session (JWT) | Development | **Running** (two instances, unchanged from Prototype 1 — see that phase's honest note on the likely-stale duplicate) | Loopback-only |
| Grafana | — | — | — | — | — | **Not deployed** (unchanged) | — |
| Admin Portal (separate from Web Portal) | — | — | — | — | — | **Does not exist as a separate app** (unchanged) | — |

## Swagger / OpenAPI

Unchanged structurally from Prototype 1: one consolidated document at `http://127.0.0.1:3900/api-docs` (UI) / `/api-docs-json` (raw), version `1.0`, Bearer JWT or `x-api-key` auth. No new catalogue-ai routes were added this phase (this phase tunes existing endpoints' internal behavior, not the route surface) — the same 10 `/catalogue/*` routes from Prototype 1 remain the full set.

## Real live checks performed this phase

- `GET /health` — real, all three dependencies `ok` simultaneously.
- `GET /metrics` — confirmed the 4 new Prometheus counters (`aios_catalogue_query_route_total`, `aios_catalogue_claims_removed_total`, `aios_catalogue_refusal_total`, `aios_catalogue_confidence_total`) are registered and scrapeable.
- `POST /auth/register` — confirmed live that the security-hotfix response no longer contains `passwordHash`/`mfaSecretEncrypted`.
- `POST /catalogue/search` (deterministic) and `POST /catalogue/rag/ask` (generative, real generation call) both re-confirmed working against the live server with a real JWT.
- A real `STOREKEEPER`-role user (no `ai.chat` permission) is registered and checked against `POST /catalogue/rag/ask` by `scripts/verify-dgx-prototype-1-5.ts` step 29 — see that script's real output for the pass/fail result.

## What changed vs. Prototype 1's inventory

Nothing structural — no new service, no new port, no new route. The only additions are the four new metric names exposed on the existing `/metrics` endpoint and the real cache entries now created in the existing Redis instance by `findByOemNumber()`.
