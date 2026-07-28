# Applicability Model

Which vehicles, parts, engines, and fault codes a `KnowledgeItem` applies to — four independent junction tables, not one cross-product table:

- `KnowledgeItemVehicleApplicability`
- `KnowledgeItemPartApplicability`
- `KnowledgeItemEngineApplicability`
- `KnowledgeItemFaultCodeApplicability`

Each is a real `(itemId, targetKey)` pair with an optional `conditions` JSON field for compound qualifiers (e.g., "only for the 2018+ model year variant"). Real usage: `KnowledgeRetrievalService.enrichContext()` queries `KnowledgeItemPartApplicability` directly to find items applicable to a given part for the additive Catalogue AI integration (see `catalogue-ai-integration.md`).

## Why not one cross-product table

An item applicable across many vehicles × parts × engines × fault codes would combinatorially explode a single joined table. Four independently indexed tables avoid that at the cost of a real, accepted limitation: **no database constraint can enforce cross-dimension consistency** (e.g., that a part-applicability row and an engine-applicability row on the same item are mutually compatible). This is service-layer convention only — a named risk, not a silently assumed one.
