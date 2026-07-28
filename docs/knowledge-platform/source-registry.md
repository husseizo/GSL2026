# Knowledge Source Registry

Every real source (internal documentation, internal case-work, real catalogue-derived facts, and eventually licensed OEM material) must be registered here before anything can be ingested from it. See `KnowledgeSourceRegistryService` (`src/knowledge-platform/source-registry/`).

## Model

One real `KnowledgeSource` table — of the ~10 sub-entities the spec describes, only this one has an independent lifecycle or query pattern; license terms, access classification, and contact info collapse into JSON/string fields (see `decision-log.md`).

- `authority`: `OEM_OFFICIAL | OEM_AUTHORIZED_DISTRIBUTOR | INDEPENDENT_TECHNICAL_PUBLISHER | INTERNAL_WORKSHOP | COMMUNITY_SOURCED | UNKNOWN` — see `authority-hierarchy.md`.
- `status`: `DISCOVERED → UNDER_REVIEW → APPROVED | APPROVED_WITH_RESTRICTIONS | REJECTED → EXPIRED | SUSPENDED | WITHDRAWN | ARCHIVED`.
- `accessClassification`, `allowedInternalUse`, `allowedAiUse`, `allowedEmbeddingUse`, `allowedQuotationUse`, `redistributionRestrictions` — the real, enforced access-control surface (see `security-encryption-access.md`).

## The real publish-eligibility gate

`assertPublishEligible(sourceId)` is called by `KnowledgeItemRegistryService.publish()` before every publish. A source with `authority === 'INTERNAL_WORKSHOP'` is always eligible (no external license to verify). Any other authority must have `status` of `APPROVED` or `APPROVED_WITH_RESTRICTIONS` — i.e., a real human has run `verifyLicense()` or `approveWithRestrictions()` — or `publish()` throws. This is the real mechanism preventing an unlicensed OEM document from ever becoming AI-consumer-visible content.

## Real lifecycle methods

`register()`, `verifyLicense()`, `approveWithRestrictions()`, `reject()`, `suspend()`, `getById()`, `list()` — every state transition is audit-logged via `AuditService` at the call site (see `audit-logging.md`).
