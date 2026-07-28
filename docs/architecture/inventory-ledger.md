# Inventory Ledger

`src/inventory/` — `InventoryLedgerService.postMovement()` is the single choke point every inventory-affecting event goes through: sales issue, purchase receipt, transfer, adjustment, damage, quarantine, reservation. Nothing else writes to `InventoryBalance` directly.

## Why a ledger, not a mutable quantity column

A single `quantity` column on the part/lubricant row can't answer "why is this the balance" or "was this a sale or a stock count correction," can't be replayed to detect drift, and can't be made idempotent against duplicate imports. Every business fact (`InventoryMovementType`: `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `SALE_ISSUE`, `GARAGE_ISSUE`, `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `TRANSFER_OUT`/`IN`, `RESERVATION`/`RESERVATION_RELEASE`, `ADJUSTMENT_IN`/`OUT`, `DAMAGE`, `QUARANTINE`, `WARRANTY_ISSUE`/`RETURN`, `STOCK_COUNT_CORRECTION`) is recorded as an immutable `InventoryMovement` row; `InventoryBalance` is a transactionally-maintained *projection* of that history, not the source of truth itself. See [decision-log.md](decision-log.md).

## Balance-effect mapping

`src/inventory/balance-effects.ts` is the one place that defines what each movement type does to the balance: which bucket it touches (`onHand`, `reserved`, `damaged`, `quarantined`) and, for `DAMAGE`/`QUARANTINE`, that stock leaves `onHand` **and** lands in the secondary bucket in the same movement. Each movement type (except `ADJUSTMENT_IN`/`OUT` and `STOCK_COUNT_CORRECTION`, which are legitimately bidirectional) has a fixed expected `direction` — `postMovement()` rejects a call that passes the wrong one rather than silently corrupting the balance (see the "rejects DAMAGE movements posted with the wrong direction" integration test).

## Available stock invariant

```
available = onHand - reserved - quarantined - damaged
```

`incoming` and `inTransit` are tracked on `InventoryBalance` but deliberately **excluded** from `available` — they're informational (used by the recommendation engines directly), not physically available to promise to a customer. This is computed on read (`computeAvailable()`), never stored as a column, so it can't drift out of sync with its inputs.

## The itemKey surrogate — a real bug this design avoids

Postgres unique indexes treat `NULL` as distinct from `NULL`. `@@unique([partId, lubricantProductId, warehouseId])` would **not** stop two balance rows from being created for the same part (`lubricantProductId` is `NULL` on both, and `NULL ≠ NULL` under standard SQL semantics) — this is a genuine, easy-to-miss bug, not a hypothetical one; it was caught during Phase 2 development before it shipped. `InventoryBalance`, `InventoryItemMetric`, and `StockSnapshot` all use a non-null surrogate (`itemKey = "part:<id>"` or `"lubricant:<id>"`, computed by `src/inventory/item-key.ts`) as the actual unique key instead. Compare this to `Vehicle`/`Part`/`Customer`'s `@@unique([sourceSystem, sourceRecordId])`, both nullable — there, the same NULL-distinct behavior is *correct*, because it's what allows multiple natively-created (non-imported) records to coexist. Same SQL quirk, opposite implications depending on whether NULL-collision is a bug or a feature for that particular constraint.

## Negative stock

`postMovement()` allows `onHand` to go negative rather than silently clamping it to zero — the spec is explicit that source data errors must be visible, not hidden. When a movement would drive `onHand` negative, `InventoryBalance.hasNegativeStockIssue` is set and a `DataQualityIssue` (`negative_available_stock`, `RECOVERABLE`) is recorded, preserving the actual (negative) value for a human to investigate.

## Transactions and idempotency

`postMovement()` accepts an optional caller-owned Prisma transaction client. Callers that already run inside their own `$transaction` (reservations, transfers, goods receipts) pass their `tx` through so a second, independent transaction is never nested on top of the first — nesting two transactions touching overlapping rows risks a Postgres lock-wait deadlock. When no `tx` is supplied, `postMovement()` wraps itself in its own transaction.

Idempotency reuses the exact Phase 1 pattern: a movement carrying `(sourceSystem, sourceRecordId)` that already exists is returned as-is rather than re-posted — verified directly against a real database in `inventory-ledger.integration-spec.ts`.

## Reservations, transfers, adjustments

- **Reservations** (`ReservationsService`) increase `reserved` without touching `onHand` — narrowing `available` so the same unit can't be promised twice. `release()`/`consume()` post the inverse.
- **Transfers** (`TransfersService`) record intent only on `create()` (status `DRAFT`); stock actually leaves the source on `approve()` (`TRANSFER_OUT`, status → `IN_TRANSIT`) and lands at the destination on `receive()` (`TRANSFER_IN`, status → `RECEIVED`) — so an approved-but-not-yet-received transfer never double-counts stock at both ends.
- **Adjustments** (`AdjustmentsService`) are two-step: `create()` only records the request; `approve()` is what actually posts the movement — the same approval-before-execution principle the spec applies to purchase recommendations, applied here to manual stock corrections too.
