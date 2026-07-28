# Conflict Findings

## New cross-source comparators

`knowledge-conflict.service.ts` gained new comparator functions appended to the existing, unmodified `detectAndPersistConflicts()` orchestration:

- `detectApprovalStatusConflicts()` — a pure function catching cases where one source claims an official approval and another claims only a recommendation for the same lubricant/spec, using the widened `approval_statement` claim-type pattern (see [entity-normalization.md](entity-normalization.md)).
- Existing `VALUE_MISMATCH` detection (from DGX 1.7) continues to run unmodified, now also seeing the real, larger corpus.

`KnowledgeConflict.conflictType` remains a plain `String` column (confirmed via schema inspection) — `'APPROVAL_STATUS_MISMATCH'` is a new string value, not a new enum member, avoiding a schema change for what is fundamentally free-text categorization.

## Real conflicts found

4 real `KnowledgeConflict` rows exist in the live database, all `conflictType: 'VALUE_MISMATCH'`, all resolved (`status: 'RESOLVED_KEEP_A'`). 0 open conflicts remain. This falls well short of the spec's 50+ conflict-case target — an honest gap, not a fabricated one: the real published sample (123 item versions, drawn mostly from internally-consistent sources: self-authored SOPs, a single Liqui Moly cache, a single TecDoc catalogue) does not naturally contain many genuine cross-source contradictions, because most of the real corpus has only one authoritative source per fact. Reaching the 50+ target for real would require onboarding a second, independently-authored source covering overlapping content (e.g., a real Category B/C source — see [source-inventory.md](source-inventory.md)), which this pilot did not acquire.

## Resolution discipline

Conflicts are never resolved by picking the highest-authority source without checking date/applicability — `KnowledgeConflictService`'s resolution path (unmodified from DGX 1.7) requires an explicit reviewer decision recording which value was kept and why.

## API

`GET`, `POST detect/:itemId`, `POST :id/resolve` on `KnowledgeConflictController` (new this phase).
