# Lost-Sales Detection

`src/lost-sales/` — deterministic, rule-based only. No ML in Phase 2 (see [03-ai-platform.md](03-ai-platform.md)).

## Trigger reasons

`LostSaleReason`: `ZERO_RESULT_SEARCH`, `OUT_OF_STOCK_VIEW`, `INSUFFICIENT_STOCK_CHECK` (a `STOCK_CHECK` event whose `metadata.availableQuantity < requestedQuantity`), `QUOTE_ABANDONED`, `ORDER_FAILED_STOCK` (an `ORDER_FAILED` event with `errorCode` of `INSUFFICIENT_STOCK`/`OUT_OF_STOCK`), `REPEATED_SEARCH_NO_SALE`, `MANUAL_REPORT`.

The first five map one-to-one from a single `AppEvent`. `REPEATED_SEARCH_NO_SALE` is the one aggregate rule: group `SEARCH` events by `(sessionId, searchQuery)`, and if a group's count reaches `repeatSearchThreshold` (default 3) **and** that session never produced an `ORDER_CREATED` event, it's flagged as latent demand that never converted.

## Deduplication

Every direct-trigger candidate is created via an **upsert keyed by `dedupeKey`** — `${reason}:${itemKey}:${sessionOrCustomerKey}:${timeBucket}`, where `timeBucket` is the event's timestamp floored to a configurable window (default 30 minutes). Repeated identical events within the same window collapse onto the same candidate row instead of creating duplicates; each contributing event is still linked via `LostSaleEvidence` so the evidence trail grows even though the candidate count doesn't. This is the same upsert-by-derived-key idiom Phase 1 uses for `PartMatchCandidate` — proven pattern, reused rather than reinvented.

Verified directly against Postgres in `lost-sales-engine.integration-spec.ts`: two `OUT_OF_STOCK_VIEW` events in the same session collapse into one `LostSaleCandidate` with two `LostSaleEvidence` rows.

## Configuration

`src/lost-sales/lost-sales.config.ts` — `sessionWindowMinutes`, `repeatSearchThreshold`, `candidateExpirationDays`, injectable via `LOST_SALES_CONFIG` — not hardcoded inside `LostSalesEngineService`.

## Human review

`LostSaleCandidate.status`: `OPEN → CONFIRMED | DISMISSED | CONVERTED | EXPIRED`. A human calls `confirm()`/`dismiss()`/`convert()`; a candidate can only transition once (attempting to confirm an already-resolved candidate throws). `recordManual()` lets a human record a lost sale directly with no log evidence at all — always `HIGH` confidence, since it's a direct human observation, not an inference.
