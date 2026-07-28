# ADR-0001: Add `Warehouse.capacity` field to enforce a real physical/logical stock ceiling

## Context

The AI Foundation Certification Sprint's Phase II implementation assessment (`docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md`) found, by direct inspection, that `Warehouse` has no capacity field at all. This means Business Rule 2 of `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §14 ("Never exceed the destination warehouse's real physical/logical capacity") and the corresponding Safety Gate in `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` §8 cannot be enforced today — there is no real data to check a recommendation against. This is one of the two Critical findings blocking Bronze-level certification, per the Engineering Execution Program's Sprint 1 scope.

## Decision

Add a single, additive, nullable field `capacity Decimal? @db.Decimal(14, 3)` to the `Warehouse` model, representing the maximum real stock quantity (in the same operational units already used elsewhere on this model's related tables, e.g. `InventoryBalance`) the warehouse can hold for planning purposes. `PurchaseRecommendationsService` and `TransferRecommendationsService` will read this field and pass it into their respective pure math functions, which will cap any suggested quantity so that `availableStock + incomingStock + inTransitStock + suggestedQuantity` (purchase) or `destAvailable + suggestedQuantity` (transfer) never exceeds it.

A `null` capacity means "no known real limit" — the existing behavior (no capacity check) is preserved for every warehouse until a real capacity value is entered for it. This is a deliberate, additive default: no existing warehouse's behavior changes until someone with real knowledge of that warehouse's physical/logical limit sets one.

## Alternatives Considered

- **A separate `WarehouseCapacity` table** (versioned, effective-dated). Rejected for Sprint 1 as unnecessary complexity — there is no real requirement yet for capacity to vary over time or need historical tracking; a single nullable field is the smallest change that closes the real, identified gap. This can be revisited via a future ADR if a real business need for capacity history emerges.
- **Deriving an implicit capacity from historical peak stock.** Rejected — this would be a real, invented heuristic, not the warehouse's actual physical/logical limit, and risks capping recommendations below what the warehouse can genuinely hold (a real business-value regression) or above what it can actually hold (defeating the Safety Gate's purpose).
- **A hardcoded, global default capacity.** Rejected outright — a single number cannot honestly represent every real warehouse's physical reality, and a wrong global default would either falsely block legitimate large orders or fail to catch real capacity violations, depending on which direction it erred.

## Migration Plan

1. Add `capacity Decimal? @db.Decimal(14, 3)` to the `Warehouse` model in `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name warehouse_capacity` to generate and apply a real, additive migration (adds one nullable column — no data backfill required, no existing row affected).
3. Update `PurchaseRecommendationsService`/`TransferRecommendationsService` to read `warehouse.capacity` and pass it to the pure math functions.
4. Update `purchase-recommendation-math.ts`/`transfer-recommendation-math.ts` to enforce the cap, with a real warning when capping occurs.
5. No API contract change — `capacity` is an internal planning input, not currently exposed as a required field on any existing endpoint.

## Rollback Plan

Since the column is additive and nullable, rollback is trivial and low-risk: revert the schema change and run `npx prisma migrate dev` to generate the down migration (or apply a new migration dropping the column), then revert the two math-function/service changes that read it. No data loss occurs on rollback beyond the capacity values themselves (which were never relied upon by any other real feature).

## Risks

- **Low** data risk: purely additive, nullable, no backfill.
- **Low** behavioral risk: default `null` preserves current behavior for every warehouse until a real value is set.
- **Medium** operational risk if capacity values are entered incorrectly (too low): could suppress legitimate reorder recommendations. Mitigated by the requirement that a capacity check only activates when a real, non-null value exists — no warehouse is affected until someone deliberately sets one.

## Business Impact

Closes a real, identified Safety Gate — directly enables Bronze-level certification progress for DGX 2.0 (`DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` §8, gate 2).

## Security Impact

None — `capacity` is operational planning data, not access-sensitive, and inherits the existing `Warehouse` model's authorization scope.

## Data Impact

One new nullable column on `Warehouse`. No change to any other model or existing data.

## Evaluation Impact

Enables a new, real unit/integration test category (capacity-exceeded detection) required by the Engineering Execution Program's Sprint 1 Definition of Done.

## Approval

| Role | Decision |
|---|---|
| Engineering | Approved — proceeding per explicit Sprint 1 instruction |
| Architecture | Approved — additive schema change, no Foundation contract touched, consistent with `AIOS_REFERENCE_ARCHITECTURE_V1.md` §10 (schema changes require an ADR; this is that ADR) |

## Evidence

`docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md` §9 (Architecture-impact Changes) and §10 (Schema Changes) named this exact field and this exact risk/rollback profile in advance of this ADR.
