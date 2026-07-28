# Phase 5 — External System Connectivity (SAP B1 / Odoo)

Adapters for SAP Business One and Odoo, built against real, documented API contracts and tested against `nock`-mocked servers matching those contracts exactly — **never run against a live SAP/Odoo instance**, because none is reachable from this environment. This is stated honestly rather than fabricated.

## Hard rule, unchanged from Phase 1

"No adapter may directly modify Operational Core tables. Everything passes through Integration Services." Phase 5's adapters reuse Phase 1's `IntegrationService.runSync()` pipeline (fetch → validate → normalize → checksum-dedup → upsert → checkpoint → dead-letter) unchanged — see [02-integration-contracts.md](02-integration-contracts.md). Nothing new was built for the sync mechanics themselves.

## `EnterpriseSourceAdapter` (`src/integration/adapters/enterprise-source-adapter.interface.ts`)

Extends Phase 1's `SourceAdapter<TRaw>` with three additions the spec asked for: `health()` (`AdapterHealth` — reachable/unreachable, last-checked), `authenticate()`, `getMetadata()` (`AdapterMetadata` — source system name/version/capabilities). Fetch/checkpoint/replay/dead-letter were already generic in `IntegrationService` and needed no changes.

## SAP Business One (`sap-business-one.adapter.ts`)

Targets the real SAP B1 Service Layer REST API — session auth via `POST /b1s/v1/Login` returning a `B1SESSION` cookie, then `GET /b1s/v1/Items` for the item master. Maps SAP's `Items` shape into the exact `LegacyPartRaw` shape `PartSyncHandler` already expects — zero new entity-sync logic, only a field mapping. Configured entirely from env vars (`SAP_B1_BASE_URL`, `SAP_B1_COMPANY_DB`, `SAP_B1_USERNAME`, `SAP_B1_PASSWORD`); `integration-adapters.controller.ts`'s `/integration/adapters/sap-business-one/*` endpoints throw `NotFoundException` honestly if unconfigured, rather than pretending to succeed.

## Odoo (`odoo.adapter.ts`)

Targets Odoo's real JSON-RPC 2.0 API — `common/login` for session auth, `object/execute_kw` to call `product.template`'s `search_read`. Maps into the same `LegacyPartRaw` shape. Configured via `ODOO_BASE_URL`/`ODOO_DB`/`ODOO_USERNAME`/`ODOO_PASSWORD`, same honest-404-if-unconfigured behavior.

## Endpoints (`integration-adapters.controller.ts`)

`GET /integration/adapters/sap-business-one/health`, `/metadata`, `POST /sync`; same three for `/odoo/*`.

## Tests

`sap-business-one.adapter.spec.ts`, `odoo.adapter.spec.ts` (both against `nock`-mocked real-shaped HTTP contracts), `enterprise-adapters.integration-spec.ts` (3 tests, real Postgres writes via the real `IntegrationService` pipeline, mocked HTTP source).

## Known limitations

- Never exercised against a live SAP B1 or Odoo instance — contract fidelity is as good as the mocked test fixtures, which were built from each system's public API documentation, not from a real running instance.
- No SOAP adapter (SAP B1 also exposes a SOAP/DI-API surface) — REST/Service-Layer only, since it's SAP's own recommended modern integration path.
- No POS adapter built — the spec listed POS as a target system but no specific POS product/contract was named to build against.
