# Endpoint Inventory — DGX Prototype 1 Final Acceptance

## Catalogue AI endpoints (this phase's deliverable), verified live against the running backend

All 10 real, confirmed present in the live OpenAPI document (`openapi.json`, 278 total paths platform-wide) and behind `PermissionsGuard`:

| Method | Path | Permission | Verified live this session |
|---|---|---|---|
| POST | `/catalogue/search` | `parts.read` | Yes — real JWT, real OEM query, real match returned |
| GET | `/catalogue/parts/by-oem/:number` | `parts.read` | Route present in OpenAPI doc |
| GET | `/catalogue/parts/:id/alternatives` | `parts.read` | Route present in OpenAPI doc |
| GET | `/catalogue/parts/:id/supersessions` | `parts.read` | Route present in OpenAPI doc |
| POST | `/catalogue/compare-parts` | `parts.read` | Exercised via `verify-dgx-catalogue-rag.ts` step 21 |
| POST | `/catalogue/compare-lubricants` | `lubricants.read` | Exercised via `verify-dgx-catalogue-rag.ts` step 22 |
| POST | `/catalogue/search-lubricants` | `lubricants.read` | Exercised via `verify-dgx-catalogue-rag.ts` steps 18-20 |
| POST | `/catalogue/rag/ask` | `ai.chat` | Yes — real JWT, real generation call, real cited answer returned live |
| POST | `/catalogue/feedback` | `ai.chat` | Exercised via `verify-dgx-catalogue-rag.ts` step 26 |
| POST | `/catalogue/review-handoff` | `reviewQueue.assign` | Exercised via `verify-dgx-catalogue-rag.ts` step 25 |

Real negative-auth checks performed this session: no `Authorization` header → `403 Missing x-user-role header`; a malformed/invalid JWT → same real rejection (falls through to the legacy-header path, which also fails). No endpoint returned data without a real, verified actor.

## Platform-wide route map (module → base path)

Not new to this phase — listed here for completeness of the "endpoint inventory" deliverable, derived directly from each module's `@Controller(...)` decorator:

`auth`, `auth/api-keys` (identity) · `ai`, `ai/evaluations`, `ai/forecast`, `ai/knowledge-base`, `ai/model-registry`, `ai/prompts` (AI platform — assistants, feedback, evaluation, forecasting, knowledge base, model/prompt registry, RAG, twin-intelligence) · `catalogue` (this phase) · `app-events` · `backup` · `branch-gateway/:branchId` · `branches` · `cdc` · `checklists` · `customers` · `data-consolidation` · `data-readiness` · `diagnostics` · `estimates` · `garage-inventory` · `garage-jobs` · `health` · `inspections` · `integration` · `inventory`, `inventory-analytics` · `labour` · `lost-sales` · `lubricants` · `metrics` (no prefix) · `neon-cache` · `notifications`, `notification-service` · `organizations`, `organizations/:organizationId/configuration` · `parts` · `purchase-recommendations`, `purchases` · `quality-control` · `reception` · `sales` · `supplier-analytics`, `suppliers` · `technicians` · `transfer-recommendations` · `vehicles`, `vehicles/:vehicleId`, `repeat-repair-flags`, `garage-jobs/:jobId/repeat-repair` · `warehouses` · `workshop-analytics`, `workshop-inventory-requests`.

## Authentication model (unchanged by this phase)

`JwtAuthContextGuard` (global) resolves a verified actor from a real `Authorization: Bearer <jwt>` or `x-api-key` header before any route-level guard runs; `getRequestActor()` falls back to the legacy `x-user-role`/`x-user-id` header stand-in only when no verified credential is present. Every catalogue-ai route uses `PermissionsGuard` + `@RequirePermissions(...)`, reusing permission strings that existed before this phase.
