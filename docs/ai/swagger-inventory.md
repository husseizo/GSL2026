# Swagger / OpenAPI Inventory — DGX Prototype 1 Final Acceptance

## What's live

One consolidated OpenAPI document covers the entire platform — there is no separate Swagger instance per module, and no separate Swagger for Catalogue AI specifically (it's one of the route groups within the single document).

| API | Base URL | Swagger UI | OpenAPI JSON | API version | Auth requirements |
|---|---|---|---|---|---|
| Operational Core (all modules, incl. Catalogue AI) | `http://127.0.0.1:3900` | `http://127.0.0.1:3900/api-docs` | `http://127.0.0.1:3900/api-docs-json` (also written to `services/operational-core/openapi.json` at boot) | `1.0` | Bearer JWT (`addBearerAuth()`) or `x-api-key` header (`addApiKey()`), both declared in the document's security schemes |

Verified live this session: `GET /api-docs` → `HTTP 200`; `GET /api-docs-json` → `HTTP 200`; the on-disk `openapi.json` (205,753 bytes) lists all 278 real registered paths, including all 10 real `/catalogue/*` routes for this phase.

## What's missing

- **DGX / Ollama service (port 8800)** has no Swagger/OpenAPI document — it's a small, fixed-contract FastAPI service (`/v1/generate`, `/v1/embed`, `/v1/health`, `/v1/models`) and was never given its own OpenAPI spec. Recommendation: FastAPI generates one automatically at `/docs` and `/openapi.json` with zero extra code if this service's docs are ever needed independently of the Operational Core's consolidated document — worth doing if this service is ever exposed beyond localhost.
- **Web Management Portal** is a frontend SPA, not an API — it has no Swagger surface by nature, and none is expected.
- **No API versioning beyond `1.0`** is declared for the catalogue-ai endpoints specifically; they inherit the platform's global `VERSION_NEUTRAL` default (see `main.ts`), consistent with every other Phase 1-4 route.

## Additive update — DGX Prototype 1.7

Five new controllers joined the same single consolidated OpenAPI document above — no separate Swagger instance: `knowledge/sources`, `knowledge/review`, `knowledge/snapshots`, `knowledge/graph`, `knowledge/ingestion` (all under the same `http://127.0.0.1:3900` base, same Bearer JWT/`x-api-key` auth). No new Swagger surface was created; these routes are additional paths within the existing `/api-docs`/`/api-docs-json` document.

## DGX Prototype 1.7.1 additions

Nine more controllers joined the same document, same base URL, same auth — still no new Swagger instance: `knowledge/sources/:sourceId/permissions`, `knowledge/claims`, `knowledge/items`, `knowledge/structured-facts`, `knowledge/conflicts`, `knowledge/search`, `knowledge/audit`, `knowledge/evaluation-results`, `knowledge/extraction-profiles`. See [`docs/trusted-knowledge-pilot/service-url-inventory.md`](../trusted-knowledge-pilot/service-url-inventory.md) for the full endpoint table distinguishing new-this-phase from pre-existing controllers.

## How to regenerate the OpenAPI document

`services/operational-core/src/main.ts` writes `openapi.json` to disk on every boot (`writeFileSync('openapi.json', ...)`), which `scripts/generate-sdks.ts` (Phase 5, unchanged) can feed to `openapi-generator-cli` without needing the server running at generation time.
