# Security and Access — Catalogue RAG

## Reused, not reinvented

Every `catalogue-ai` endpoint sits behind the existing `PermissionsGuard` and `@RequirePermissions(...)` decorator, using permission strings that already existed before this phase (`parts.read`, `lubricants.read`, `ai.chat`, `reviewQueue.assign` — see `src/common/permissions/permission.ts`/`role-permissions.ts`). No new permission strings were minted; role-to-permission mapping for these four strings is unchanged from before this phase, so existing role behavior elsewhere in the platform is unaffected.

`POST /catalogue/rag/ask` uses `getRequestActor(request)` (the same helper every other AI-facing endpoint in this platform uses) to resolve the real authenticated actor, rather than trusting a client-supplied user id.

## No unrestricted network exposure

`DgxClientService` only talks to `DGX_SERVICE_URL` (validated as a URI at startup by `src/config/env-validation.ts`), never to an arbitrary model endpoint chosen at request time. There is no code path in `src/catalogue-ai/` that accepts a URL from a request body and fetches it — the only outbound HTTP calls this module's dependency chain makes are the fixed `/v1/generate`, `/v1/embed`, `/v1/health`, `/v1/models` routes on the configured DGX service.

## No direct production SQL credentials in the model process

The LLM/embedding process itself never receives database credentials — see [dgx-deployment.md](dgx-deployment.md). Everything it sees is assembled application-side and handed over as plain request bodies.

## Access-policy filtering before retrieval

`VectorSearchService`'s `isApproved: true` filter (Phase 4, unchanged) means a `MANUAL_REVIEW_REQUIRED` catalogue document (ingested with `isApproved: false`) is invisible to semantic retrieval until a human approves it — access control is enforced at the retrieval layer, not left to the LLM to self-censor.

## What the assistant must not reveal

`CatalogueSearchResult` and `CatalogueRagAnswer` never include cost, supplier pricing, or purchase-history fields — the corpus itself never embeds them (see [catalogue-corpus-contract.md](catalogue-corpus-contract.md)'s "no raw transactional/financial/customer data" rule), so there is nothing sensitive for a response to leak even before any role-based filtering is considered. Role-specific field redaction beyond this (e.g. a technician seeing a different response shape than a purchasing officer) was not built as a separate access-policy layer in this phase — the existing `parts.read`/`lubricants.read` gate is all-or-nothing per those two domains, matching the granularity already used by the rest of the platform's parts/lubricants read endpoints. A finer-grained, role-specific redaction layer is a real gap to close before a broader rollout, not claimed as implemented.

## Audit

Every real DGX call (embedding or generation) is logged to `AiInferenceLog` by `AiGatewayService` — success or failure, with `actorId`, `correlationId`, `promptVersionId`, `retrievedDocumentIds`, `confidence`, `latencyMs`, `errorMessage` where applicable. `scripts/verify-dgx-catalogue-rag.ts` step 27 confirms a real `AiInferenceLog` row exists for a real generative catalogue answer. Deterministic-lookup answers correctly produce no `AiInferenceLog` entry, since no model was called — this is accurate, not a missing-audit gap.

## Secrets and network allow-listing

No new secrets were introduced by this phase — `DGX_SERVICE_URL` was already a configured, validated environment variable before this phase began. No new outbound network allow-list configuration was added or required, since the only outbound calls this module makes are the existing, already-allow-listed DGX endpoints.
