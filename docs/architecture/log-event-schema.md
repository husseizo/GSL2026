# App-Log Event Schema

`src/app-events/` — one `AppEvent` table, discriminated by `AppEventType`, rather than separate tables per event kind. See [decision-log.md](decision-log.md) for why.

## Event types

`USER_LOGIN`, `USER_LOGOUT`, `SEARCH`, `PRODUCT_VIEW`, `PRICE_CHECK`, `STOCK_CHECK`, `VIN_LOOKUP`, `CUSTOMER_LOOKUP`, `QUOTE_CREATED`, `QUOTE_ABANDONED`, `ORDER_CREATED`, `ORDER_FAILED`, `PAYMENT_FAILED`, `API_ERROR`, `SYNC_ERROR`, `OUT_OF_STOCK_VIEW`, `ZERO_RESULT_SEARCH`, `ALTERNATIVE_SELECTED`, `PERMISSION_DENIED` — exactly the spec's list, as a Prisma enum.

## Fields

`sourceApplication` + `sourceEventId` (unique together — the idempotency key), `eventType`, `occurredAt`, `userExternalId`, `customerExternalId`, `branchCode`, `warehouseCode`, `searchQuery`, `itemCode` (+ resolved `partId`/`lubricantProductId` when it matches a known item), `vin` (+ resolved `vehicleId`), `sessionId`, `correlationId`, `endpoint`, `durationMs`, `statusCode`, `errorCode`, `errorMessage`, `metadata` (JSON), `checksum`.

## Ingestion (`AppEventsService.ingestBatch`)

Per event: validate `eventType` is a known enum value and `occurredAt` parses to a real date; if either fails, route to Phase 1's dead-letter store (`entityType: 'APP_EVENT'`, stage `VALIDATE`) and continue with the rest of the batch — one bad record never fails the whole ingest call. This required a specific fix: `IngestAppEventDto.eventType`/`occurredAt` are typed as plain `@IsString()`, not `@IsEnum`/`@IsISO8601` — the framework-level `ValidationPipe` would otherwise reject the entire HTTP request before `AppEventsService` ever got a chance to isolate the one invalid record, defeating the whole per-record dead-letter design. Verified in `app-events.integration-spec.ts` against a real database.

Item/vehicle resolution (`itemCode` → `Part`/`LubricantProduct`, `vin` → `Vehicle`) happens at ingestion time so downstream analytics/lost-sales queries can join on the resolved ID directly rather than re-resolving text on every read.

Upsert is keyed by `(sourceApplication, sourceEventId)` — replaying the same event is a no-op, not a duplicate row (verified in the integration test).

## What this feeds

- **Lost-sales detection** ([lost-sales-detection.md](lost-sales-detection.md)) — `SEARCH`, `OUT_OF_STOCK_VIEW`, `STOCK_CHECK`, `QUOTE_ABANDONED`, `ORDER_FAILED`.
- **Inventory analytics** — `searchCount`/`outOfStockSearchCount` per item, feeding `InventoryItemMetric`.
- Dead-letter / failed-event review — `AppEventsController.listFailed()`.
