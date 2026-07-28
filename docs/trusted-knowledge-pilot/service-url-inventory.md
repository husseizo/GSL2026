# Knowledge Platform Endpoint Inventory

All endpoints below are real, registered NestJS controllers under `services/operational-core/src/knowledge-platform/`, mounted on the existing operational-core service (see root `docs/ai/endpoint-inventory.md` / `docs/ai/swagger-inventory.md` for the service's base URL).

| Base path | Controller | New this phase? |
|---|---|---|
| `/knowledge/sources` | `KnowledgeSourceRegistryController` | Existing (DGX 1.7) |
| `/knowledge/sources/:sourceId/permissions` | `KnowledgeSourcePermissionController` | **New** |
| `/knowledge/ingestion` | `IngestionController` | Existing (DGX 1.7) |
| `/knowledge/claims` | `KnowledgeClaimController` | **New** |
| `/knowledge/items` | `KnowledgeItemController` | **New** |
| `/knowledge/structured-facts` | `StructuredFactsController` | **New** |
| `/knowledge/conflicts` | `KnowledgeConflictController` | **New** |
| `/knowledge/review` | `KnowledgeReviewController` | Existing (DGX 1.7), extended with dual-review/escalation/batch endpoints |
| `/knowledge/graph` | `KnowledgeGraphController` | Existing (DGX 1.7) |
| `/knowledge/snapshots` | `KnowledgeSnapshotController` | Existing (DGX 1.7), gated activation is additive |
| `/knowledge/search` | `PublishedKnowledgeSearchController` | **New** |
| `/knowledge/audit` | `KnowledgeAuditController` | **New** |
| `/knowledge/evaluation-results` | `EvaluationResultsController` | **New** |
| `/knowledge/extraction-profiles` | `ExtractionProfileController` | **New** |

## Swagger

New controllers/DTOs are decorated with the same `@ApiTags`/`@ApiOperation` conventions as existing DGX 1.7 controllers; see the update to `docs/ai/swagger-inventory.md` for the consolidated listing including these additions.
