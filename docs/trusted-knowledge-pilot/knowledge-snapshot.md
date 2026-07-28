# Trusted Knowledge Snapshot

## Snapshot

`TRUSTED_AUTOMOTIVE_KNOWLEDGE_PILOT_V1` is built via the existing, unmodified `KnowledgeSnapshotService.buildSnapshot()` — no change to the blue-green snapshot state machine from DGX 1.7.

## Real snapshot state

The real pilot snapshot (version 9, id `d4edb5e7-...`) includes 122 approved `KnowledgeItemVersion`s (123 after the subsequent embedding backfill run created one more), status `APPROVED` — **not `ACTIVE`**. Activation was attempted and correctly **blocked** by the new trusted-knowledge quality gates (see [quality-gates.md](quality-gates.md)):

```
BLOCKED — KnowledgeSnapshot d4edb5e7-... failed one or more real
trusted-knowledge quality gates — activation blocked.
```

This is the expected, correct outcome given the gate failures below — the snapshot mechanism never force-activates when a gate fails.

## Fields recorded

Per spec §26: approved sources/items/claims/facts/graph relationships, unresolved conflicts (0 currently open), excluded restricted/unapproved/expired content, index/graph/eval-dataset versions, approval record (`approvedById: 'pilot-approver-1'`), intended consumers, rollback target (retains the previous `RETIRED`/`ROLLED_BACK` snapshot chain from prior verify-script runs, proving rollback is real and exercised).

## Gate results at time of last real evaluation

| Gate | Status | Actual | Threshold |
|---|---|---|---|
| EXACT_IDENTIFIER_RECALL | FAIL | 0 | 1.00 |
| MRR | FAIL | 0 | 0.90 |
| CITATION_CORRECTNESS | WAIVED | null (no citations returned yet) | 0.98 |
| UNSUPPORTED_CLAIM_RATE | PASS | 0 | ≤0.02 |
| RESTRICTED_LEAKAGE | PASS | 0 | 0 |
| EXPIRED_CURRENT_ANSWER_RATE | PASS | 0 | 0 |
| INJECTION_REFUSAL_ACCURACY | PASS | 1.00 | 1.00 |
| GOLD_HUMAN_APPROVAL | PASS | true | true |

See [quality-gates.md](quality-gates.md) for the real, investigated root cause of the two FAIL results.

## Rollback

Snapshot rollback was exercised for real by the verify script across multiple runs (`RETIRED`/`ROLLED_BACK` states present in the snapshot history table), reusing the existing, unmodified rollback mechanism.
