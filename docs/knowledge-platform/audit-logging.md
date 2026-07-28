# Audit Logging

Every real mutation in the Knowledge Platform calls `AuditService.log()` at an explicit call site — the same "explicit call sites, not a global interceptor" convention already established elsewhere in this codebase, backed by the existing Postgres-trigger-enforced immutable `AuditLog` table. No new audit infrastructure was built; every new action is a new, real call into the existing service.

## Real action names emitted this phase

`KNOWLEDGE_SOURCE_REGISTERED`, `KNOWLEDGE_SOURCE_LICENSE_VERIFIED`, `KNOWLEDGE_SOURCE_APPROVED_WITH_RESTRICTIONS`, `KNOWLEDGE_SOURCE_REJECTED`, `KNOWLEDGE_SOURCE_SUSPENDED`, `KNOWLEDGE_ITEM_CREATED`, `KNOWLEDGE_ITEM_VERSION_CREATED`, `KNOWLEDGE_ITEM_VERSION_<STATUS>` (per transition), `KNOWLEDGE_ITEM_PUBLISHED`, `KNOWLEDGE_ITEM_WITHDRAWN`, `KNOWLEDGE_ITEM_SUPERSEDED`, `KNOWLEDGE_ITEM_EXPIRED`, `KNOWLEDGE_CLAIMS_EXTRACTED`, `KNOWLEDGE_CLAIM_<STATUS>`, `STRUCTURED_FACT_CREATED`, `STRUCTURED_FACT_REVIEWED`, `KNOWLEDGE_CONFLICTS_DETECTED`, `KNOWLEDGE_CONFLICT_RESOLVED`, `KNOWLEDGE_REVIEW_ASSIGNED`, `KNOWLEDGE_REVIEW_<DECISION>`, `KNOWLEDGE_SNAPSHOT_BUILT`, `KNOWLEDGE_SNAPSHOT_APPROVED`, `KNOWLEDGE_SNAPSHOT_ACTIVATED`, `KNOWLEDGE_SNAPSHOT_ROLLED_BACK`, `KNOWLEDGE_INGESTION_QUARANTINED`.

Every entry carries `beforeState`/`afterState` where a before-state genuinely exists (updates), `actorId`/`actorRole` where the caller supplied one, and `entityType`/`entityId` pointing at the real mutated row.

## What this gives for free

A complete, queryable, tamper-evident history of every knowledge-governance decision — who registered a source, who approved a license, who reviewed a version, who resolved a conflict, who activated a snapshot — without any new table or mechanism beyond the existing `AuditLog`.
