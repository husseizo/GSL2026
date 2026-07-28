# Knowledge Conflict Management

AI must not choose one side silently — a conflict is a real, persisted `KnowledgeConflict` record, never resolved by picking whichever claim happens to be retrieved first. See `KnowledgeConflictService` (`src/knowledge-platform/conflicts/`).

## Detection — pure, deterministic, no DB

`detectConflicts(claims)` compares every pair of same-`claimType` claims on an item:

- **`VALUE_MISMATCH`** (severity `HIGH`): both claims contain a real numeric value and the values differ (e.g., "45 Nm" vs "60 Nm" on the same torque claim).
- **`AUTHORITY_MISMATCH`** (severity `LOW`): values agree but the two claims come from sources of different authority.
- **`EXPIRY_OVERLAP`**: both claims are simultaneously in-effect with contradictory content.

`detectAndPersistConflicts(itemId)` runs this against every real `KnowledgeClaim` on an item and persists each detected conflict with `status: OPEN` — verified end-to-end by the verify script (step 30, two claims with mismatched torque values on the same item).

## Resolution — always a real, human, audited act

`ConflictStatus`: `OPEN → RESOLVED_KEEP_A | RESOLVED_KEEP_B | RESOLVED_BOTH_VALID_DIFFERENT_SCOPE | UNRESOLVED_ESCALATED`. `resolve()` requires a real resolver id and a resolution note, and is audit-logged (step 31). `searchKnowledge()` surfaces any open conflict on a retrieved item's `conflicts` field rather than silently picking a side — see `retrieval-and-ai-consumer-contract.md`.
