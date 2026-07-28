# Source-of-Truth Registry

`src/data-readiness/authority/source-authority.service.ts` — the formal registry defining which real source system is authoritative for each entity, and where needed, each field.

## Design

One model, `SourceAuthorityRule` (not six separate tables as the original brief sketched — see [decision-log.md](decision-log.md)): `entityType`, `fieldName` (null = entity-level rule), `authoritativeSourceSystem`, `authorityType`, `priority`, `rationale`, `effectiveFrom`/`effectiveTo`. Superseding a decision creates a **new** row and closes the old one's `effectiveTo` — this append-only history *is* the `AuthorityDecisionHistory` the brief asked for, without a separate table duplicating what the timestamps already record.

`AuthorityType` values: `ENTITY_LEVEL`, `FIELD_LEVEL`, `TEMPORAL`, `FALLBACK`, `MANUAL`, `UNRESOLVED`.

## Real decisions seeded and verified (2026-07-13)

| Entity | Field | Authoritative source | Type | Why |
|---|---|---|---|---|
| PART | — | PARTS_CATALOG_AUTOHUB | ENTITY_LEVEL | Real, populated catalogue source of truth (see [parts-catalogue-quality.md](parts-catalogue-quality.md)); `MOLAS_Live_2021_Cache` is almost entirely empty. |
| PART | oemNumber | PARTS_CATALOG_AUTOHUB | FIELD_LEVEL | `canonical_oem_number` already proven to correctly consolidate real re-catalogued duplicates. |
| PART | sellingPrice | PARTS_CATALOG_AUTOHUB | FALLBACK | Only real commercial price field profiled for spare parts; not assumed authoritative for other commercial fields (stock, supplier) without separate evidence. |
| LUBRICANT | — | MOLAS_CACHE_LUBRICANTS | ENTITY_LEVEL | Real, actively-synced SAP↔Odoo middleware product master. |
| LUBRICANT | apiClassification | UNRESOLVED | UNRESOLVED | No verified technical-specification source was imported this phase — marked unresolved, not guessed. |
| CUSTOMER | — | MOLAS_CACHE_LUBRICANTS | ENTITY_LEVEL | Only source with a real customer master; AutoHub has no dedicated customer table. |
| SALES_DOCUMENT | grandTotal | MOLAS_CACHE_LUBRICANTS | FIELD_LEVEL | Reconciled exactly (zero variance) — see [docs/data-consolidation/sales-reconciliation.md](../data-consolidation/sales-reconciliation.md). |
| GARAGE_QUOTATION | — | UNRESOLVED | UNRESOLVED | No real, reachable Odoo source confirmed — see [docs/data-sources/odoo-garage-profile.md](../data-sources/odoo-garage-profile.md). |

## Conflicts

`AuthorityConflict` records a real disagreement between sources for one entity/field (`conflictingSources: [{sourceSystem, value}, ...]`), with `resolutionStatus` reusing the existing `ManualReviewStatus` enum (no new status enum invented for the same concept). None were detected in this phase's real data — both entity-level authorities (lubricants vs. spare parts) draw from disjoint real sources with no overlapping claim.

## Access

`GET /data-readiness/authority-rules`, `/data-readiness/authority-conflicts` (permission `dataAuthority.read`).
