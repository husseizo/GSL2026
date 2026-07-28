# Permissions & Roles

23 new permission strings, added under a `// DGX Prototype 1.7 — Automotive Knowledge Platform` comment block in `src/common/permissions/permission.ts`:

`knowledgeSource.{read,manage,verifyLicense}`, `knowledgeItem.{read,draft,manage,approve,publish,withdraw}`, `knowledgeReview.{read,assign,decide}`, `structuredFact.{read,manage,review}`, `knowledgeConflict.{read,resolve}`, `knowledgeSnapshot.{read,manage}`, `knowledgeGraph.{read,manage}`, `knowledgeRetrieval.query`, `knowledgeSecurity.read`.

## Role wiring

- The 8 `.read`/`.query` permissions were added to `ALL_READ` in `role-permissions.ts` — inherited automatically by `AUDITOR`/`READ_ONLY_VIEWER`.
- `GENERAL_MANAGER` gained the final-approve/publish/withdraw verbs (`knowledgeItem.approve`, `knowledgeItem.publish`, `knowledgeItem.withdraw`) — the platform's real "final say" authority stays with the same role that already holds `ai.evaluations.manage`/`ai.knowledgeBase.manage`.
- A brand-new role, `Role.KNOWLEDGE_STEWARD`, was added — a dedicated technical/licensing reviewer persona. It holds everything **except** `knowledgeItem.approve`/`publish`/`withdraw`: source registration/license-verification, drafting, review assignment/decision, structured-fact management/review, conflict resolution, snapshot/graph read access.
- `SYSTEM_ADMINISTRATOR`/`OWNER` inherit every new permission via the existing `[...PERMISSIONS]` spread pattern.

Verified end-to-end by the verify script (step 42): `KNOWLEDGE_STEWARD` genuinely lacks publish/withdraw; `GENERAL_MANAGER` genuinely has `knowledgeItem.publish` — read directly from the live `ROLE_PERMISSIONS` map, not asserted separately.
