# Source Permission Matrix

## Model

`KnowledgeSourcePermission` (new, additive Prisma model) stores one row per `(sourceId, action)`, where `action` is one of the 13 `KnowledgeSourceAction` enum values: `STORE_ORIGINAL, PARSE, EXTRACT_METADATA, EXTRACT_STRUCTURED_FACTS, CREATE_SEARCH_INDEX, CREATE_EMBEDDINGS, USE_FOR_RAG, DISPLAY_TO_INTERNAL_USER, DISPLAY_EXCERPT, EXPORT, REDISTRIBUTE, USE_FOR_MODEL_TRAINING, USE_FOR_FINE_TUNING`.

This is a real junction table, not 13 booleans — matching the schema's own existing convention for per-dimension permission rows (e.g. `KnowledgeItemVehicleApplicability`).

## Two enforcement surfaces — a named, real risk

`KnowledgeSource` already carries legacy boolean fields (`allowedAiUse`, `allowedEmbeddingUse`, `redistributionRestrictions`, etc.) from DGX 1.7. `KnowledgeSourcePermissionService.assertActionAllowedAndLegacyFlag()` is the one function that combines both via **AND logic** — an action is allowed only if the new matrix row says so **and** the corresponding legacy flag also permits it. Every real call site in this phase uses this combined assertion, never the matrix alone. `assertActionAllowed()` (matrix-only) exists for the permission-matrix controller/tests but is not the production enforcement path.

**This is named explicitly as a real risk**: if a future caller checks only one of the two surfaces, permission could silently diverge. A verify step (permission-matrix enforcement checks, steps 11–16) proves that denying an action in the matrix blocks the action even when the legacy boolean would have allowed it, and vice versa.

## Explicit rule enforced

Per spec: RAG permission is never treated as training permission, and internal-viewing permission is never treated as embedding permission. `USE_FOR_RAG` and `USE_FOR_MODEL_TRAINING`/`USE_FOR_FINE_TUNING` are independent matrix rows; none of the real onboarded sources this pilot has `USE_FOR_MODEL_TRAINING` or `USE_FOR_FINE_TUNING` granted (no model training occurs this phase — see [decision-log.md](decision-log.md)).

## Real counts

78 `KnowledgeSourcePermission` rows exist across the 4 real production sources plus the verify script's transient synthetic sources exercising every category (company-owned / supplier / licensed / restricted).

## API

`GET/POST` on `KnowledgeSourcePermissionController` (`src/knowledge-platform/permissions/knowledge-source-permission.controller.ts`) — `setPermission`, `setPermissionMatrix` (bulk), `assertActionAllowed`.
