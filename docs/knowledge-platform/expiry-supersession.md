# Expiry & Supersession

See `KnowledgeLifecycleService` (`src/knowledge-platform/expiry-supersession/`).

## Supersession

`supersede(oldVersionId, newRawContent, newTitle)` requires the old version to be `PUBLISHED`, creates a real new version (`version = old.version + 1`, `supersedesVersionId` pointing back), publishes it, and only then flips the old version to `SUPERSEDED` and de-approves its materialized `KnowledgeDocument` — the append-only chain is never edited in place, and the old row remains historically accessible via `listVersions()`/`getById()` forever. Verified end-to-end by the verify script (step 29): the old version stays queryable, `KnowledgeItem.currentVersionId` moves to the new one.

## Expiry

`markExpired(now)` is a real date comparison (`effectiveUntil` in the past) against every `PUBLISHED` version, callable on demand. It flips matching versions to `EXPIRED` and de-approves their materialized `KnowledgeDocument` in the same lock-step invariant `publish()`/`withdraw()` establish. Verified by the verify script (step 32).

**Honest limitation**: no live scheduler/cron triggers this automatically in this environment — the same `SCHEDULED_DOC_ONLY` limitation DGX Prototype 1.6 already documented for its own continuous-evaluation section. `markExpired()` is real and correct; nothing calls it on a timer yet.

## Freshness classification

`classifyFreshness(version)` is a pure, real-date-driven classification (`CURRENT | STALE | EXPIRED | SUPERSEDED | WITHDRAWN | UNKNOWN_FRESHNESS`) — never an LLM judgment. `KnowledgeRetrievalService.searchKnowledge()` uses this directly to decide inclusion/exclusion.
