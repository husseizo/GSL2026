# Phase 2 — Commercial Data Foundation and Inventory Intelligence

Builds directly on [Phase 1](00-overview.md) (vehicle master, parts master, integration engine) without modifying it. Phase 2 adds everything needed to answer, from real data: what was sold, where, to whom, what's in stock, what's at risk of stocking out, what's dead, and what should be bought or transferred — all through deterministic, explainable rules. No AI/ML in this phase; see [03-ai-platform.md](03-ai-platform.md) for why that's deliberate and deferred.

## 1. Non-negotiables carried forward

Everything from [00-overview.md §4](00-overview.md) still applies: no destructive integration, no silent overwrites, no automatic merges, no untraceable calculations, no PO created without approval. Phase 2 adds: no automatic inventory adjustment for a source correction that arrives after the original movement already posted (see §2.4 below) — a human resolves those explicitly rather than the ledger silently re-adjusting itself.

All new imported records carry the same sync envelope as Phase 1 (source system, source record ID, external ID, version, checksum, timestamps, sync status) — see the `Sales`/`Purchase`/`Customer`/`Lubricant`/`Supplier` models in `prisma/schema.prisma`.

Timestamps are stored and computed in UTC. `src/common/timezone.ts` is the one conversion point for displaying a UTC instant in `Africa/Dar_es_Salaam` — applied where a response needs a human-readable local time, not retrofitted onto every field.

## 2. Domain additions

### 2.1 Organization / Branch / Warehouse
Straightforward hierarchy: `Organization` → `Branch` → `Warehouse`, with `WarehouseType` (MAIN/RETAIL/GARAGE/LUBRICANTS/TRANSIT/QUARANTINE/DAMAGED/RETURNS). Codes are unique within their parent (`@@unique([organizationId, code])`, `@@unique([branchId, code])`).

### 2.2 Customers
`Customer` + `CustomerContact` + `CustomerAddress` + `CustomerVehicleLink` (many-to-many with history, since ownership changes) + `CustomerExternalReference`. Uses the same nullable sync-envelope pattern as Vehicle/Part so a customer can be either imported or created natively.

**Unresolved customer references**: rather than a separate "unresolved reference" table, `SalesDocument.unresolvedCustomerRef` holds the raw source code when it doesn't resolve to a `Customer` row. One extra column beats a whole parallel table for a single string — see [decision-log.md](decision-log.md).

### 2.3 Lubricants
First-class catalogue: `LubricantProduct`, `LubricantApproval` (OEM approvals stored *exactly* as supplied — never inferred), `LubricantCompatibility`, `LubricantAlternative` (reuses Phase 1's `MatchCandidateStatus` enum — propose, never auto-approve, exactly the same shape as `PartMatchCandidate`), `LubricantExternalReference`.

Viscosity/API/ACEA classification live as scalar fields directly on `LubricantProduct` rather than a separate `LubricantSpecification` table — they're 1:1 with the product, not a multiplicity relationship, so a join table would be pure ceremony.

### 2.4 Sales and Purchases
`SalesDocument`/`SalesDocumentLine` and `PurchaseDocument`/`PurchaseDocumentLine` mirror the Phase 1 sync pattern but resolve customer/branch/warehouse/item references from codes, which requires DB lookups. That needed one small, backward-compatible extension to Phase 1's `EntitySyncHandler` interface: `normalize()` may now return `Promise<TNormalized>` (see `src/integration/entity-sync-handler.interface.ts`). `IntegrationService.runSync` always `await`s it, so Phase 1's synchronous handlers are unaffected.

**Idempotency at both levels**: the document-level checksum (Phase 1's existing skip-if-unchanged mechanism) makes a whole-document replay a no-op. Independently, `PurchaseDocumentSyncHandler`/`SalesDocumentSyncHandler` compute a **per-line checksum** and skip rewriting a line whose content hasn't changed — so a source update that touched one line doesn't rewrite every sibling line.

**What happens when a line changes after its inventory movement already posted**: the line updates, but the ledger is **not** auto-adjusted. A `DataQualityIssue` (`sales_line_changed_after_posting`, `MANUAL_REVIEW`) is raised instead. Silently reposting the new quantity as a fresh movement would either double-count or under-count depending on whether the correction was a delta or a replacement — there's no way to tell from the source data alone, so a human resolves it via an explicit `InventoryAdjustment`. See [decision-log.md](decision-log.md).

**PO vs GRN**: importing a `PurchaseDocument` never posts inventory. Stock only arrives via `GoodsReceiptsService.recordReceipt()` — the real-world distinction between placing an order and receiving goods. Sales documents are different: an imported `INVOICE`/`DELIVERY`/`COUNTER_SALE` line *does* post a `SALE_ISSUE` movement at import time (a `RETURN` posts `CUSTOMER_RETURN`), because by the time a completed sale reaches AIOS from the legacy POS, the stock has already left the building — the ledger is being built retroactively from history, not asked permission first. `QUOTATION`/`SALES_ORDER`/`CREDIT_NOTE` never move inventory.

### 2.5 Suppliers
Plain CRUD (`Supplier`, `SupplierExternalReference`) plus `SupplierMetric` (§9 below).

### 2.6 Inventory ledger
See [inventory-ledger.md](inventory-ledger.md) — its own document, since this is the piece everything else depends on.

## 3. Application-log ingestion

One `AppEvent` table with an `AppEventType` discriminator and a `metadata` JSON column, not four separate tables (`AppEvent`/`SearchEvent`/`ProductInteractionEvent`/`TransactionFailureEvent`) as a literal reading of the spec's entity list might suggest. All four "kinds" share the same shape; splitting them would be four copies of the same columns filtered by `WHERE eventType = ...`. See [log-event-schema.md](log-event-schema.md) and [decision-log.md](decision-log.md).

Invalid events (unknown `eventType`, unparseable `occurredAt`) are routed to Phase 1's dead-letter store per-event, not rejected as a whole batch — see `AppEventsService.ingestBatch`. This required loosening `IngestAppEventDto`'s validation to plain strings for those two fields specifically: `class-validator` would otherwise reject the entire HTTP request before the service ever got a chance to isolate the one bad record.

## 4. Lost-sales detection

See [lost-sales-detection.md](lost-sales-detection.md).

## 5–6. Inventory analytics and classification

See `src/inventory-analytics/` — `metrics-math.ts` (pure, unit-tested) for demand stats / ABC / XYZ / movement classification, `inventory-analytics.service.ts` for the DB orchestration. Recomputed by an explicit `recalculate()` call (a batch job), never derived ad hoc per API request.

**Minimum history**: an item younger than `minHistoryDaysForClassification` (default 30 days) classifies as `NEW_ITEM` (age ≤ `newItemMaxAgeDays`, default 14) or `INSUFFICIENT_HISTORY` (older than that but still under the minimum) — never given a false-confidence movement class. **Sparse demand**: daily-demand series are built with one entry per day in the lookback window, zeros included, so intermittent items don't get their mean inflated by only averaging over days that had a sale.

**Scale note**: the current implementation loads recent movements/sales/events into memory and aggregates in JS rather than pushing the aggregation into SQL. That's fine at Phase 2's data volumes; a high-volume deployment would push this into the Phase 4 analytics warehouse instead of the operational DB.

## 7–8. Recommendation engines

See [purchase-recommendation-engine.md](purchase-recommendation-engine.md) for purchasing, and the transfer engine in `src/transfer-recommendations/transfer-recommendation-math.ts` for inter-branch transfers — evaluated before an external purchase, only ever proposing (never executing) a move, and only using `available` stock (which already excludes reserved/damaged/quarantined units) so those exclusions are structural, not a separate check.

## 9. Supplier performance

`src/supplier-analytics/supplier-metric-math.ts` computes lead time, on-time %, fill rate, price variance, quantity accuracy, receipt completion from real `PurchaseDocumentLine`/`GoodsReceipt` data. Below a minimum sample size (3 lines) every metric is `null` and `dataSufficiency` is `INSUFFICIENT_DATA` — deliberately no single blended "supplier score," per the spec's explicit instruction not to rank without evidence.

## 10–11. APIs and RBAC

REST endpoints follow Phase 1's controller/guard conventions. See [rbac-permissions.md](rbac-permissions.md) for the full permission model and its scope limitations.

## 12. Audit

`AuditService.log()` (`src/common/audit/`) is called explicitly from the specific mutation points the spec lists (customer changes, inventory adjustments, lost-sale review, recommendation generation/approval) — not a global interceptor. Explicit call sites are what makes the trail traceable and testable; see [decision-log.md](decision-log.md).

## 13. Data quality

See [data-quality-phase-2.md](data-quality-phase-2.md).

## 17. Module layout

`organizations`, `branches`, `warehouses`, `customers`, `lubricants`, `suppliers`, `purchases`, `sales`, `inventory` (ledger/reservations/transfers/adjustments), `app-events`, `lost-sales`, `inventory-analytics`, `purchase-recommendations`, `transfer-recommendations`, `supplier-analytics` — one NestJS module per bounded concern, matching the spec's suggested boundaries, each independently extractable later without having built a microservice mesh prematurely.
