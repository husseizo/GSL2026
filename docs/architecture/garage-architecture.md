# Phase 3 — Garage Operations, Service Intelligence and Vehicle Lifecycle

Builds on [Phase 1](00-overview.md) (vehicle/parts master, integration engine) and [Phase 2](phase-2-commercial-foundation.md) (commercial foundation, inventory ledger) without modifying either. Phase 3 makes the garage the operational heart of the system — reception, job cards, inspection, diagnostics, estimates, labour, technicians, parts consumption, quality control, and a computed Vehicle Digital Twin — while every domain it touches (inventory, sales, customers, vehicles, audit) stays exactly the single source of truth it already was.

## Why this doesn't require changing the foundation

Every new Phase 3 module is additive: new Prisma models, new NestJS modules, new permissions. Nothing in Phase 1/2's schema, services, or controllers was renamed or restructured — see the two migrations (`20260711025105_phase3_garage_operations`, `20260711030919_phase3_garage_roles`) which only `CREATE TABLE`/`ALTER TABLE ... ADD COLUMN`/`ALTER TYPE ... ADD VALUE`, never drop or rename an existing column. A future domain (body shop, tyre center, fleet, EV workshop) plugs in the same way Phase 3 did: its own tables, its own module, reusing the existing Inventory/Customer/Vehicle/Audit/Checklist/Notification primitives rather than inventing parallel ones. The checklist engine (§2 below) and the reservation/issue/return pattern (§3) are the two pieces most obviously designed for that reuse.

## 1. Core architectural rule: garage never touches inventory directly

`src/garage-inventory/garage-inventory.service.ts` is the *only* place garage code talks to inventory, and every method in it is a thin call-through to Phase 2's `ReservationsService`/`InventoryLedgerService` — there is no new inventory-mutating logic in Phase 3. Concretely:

- `reservePart()` → `ReservationsService.reserve()` (increases `reserved`, not `onHand`).
- `issue()` → `ReservationsService.consume()` then `InventoryLedgerService.postMovement({ movementType: GARAGE_ISSUE, direction: OUT })`.
- `returnUnused()` → `postMovement({ movementType: ADJUSTMENT_IN, direction: IN })` — reuses the existing adjustment-in movement type rather than inventing a `GARAGE_RETURN` type; an unused part going back to the shelf is exactly what `ADJUSTMENT_IN` already models (see [decision-log-phase3.md](decision-log-phase3.md)).
- `releaseReservation()` → `ReservationsService.release()`.

`GarageJobLine.reservationId` links a job line to the `StockReservation` it came from, so `issue()`/`returnUnused()` always resolve item/warehouse from the reservation rather than trusting the caller to repeat them. Verified end-to-end in `garage-inventory.integration-spec.ts` by reading real `InventoryBalance` rows after each call (reserve moves `reserved` only, issue reduces `onHand`, return restores it, release restores `available` with no `onHand` change).

## 2. Generic checklist engine, not three parallel schemas

`ChecklistTemplate` → `ChecklistTemplateItem`, `ChecklistResponse` → `ChecklistResponseItem` is one reusable structure, used for vehicle reception, job-card, and quality-control checklists alike (via `context`/`referenceId`) rather than three near-identical `ReceptionChecklist`/`JobChecklist`/`QualityChecklist` schemas. The inspection engine (`InspectionTemplate`/`InspectionSection`/`InspectionItem`/`InspectionResult`) is a separate, richer structure — it carries findings, severity, recommended action, and required parts/lubricants that a plain checklist item doesn't need — but follows the same template/response split.

## 3. Reuse over duplication — concrete instances

- **Invoicing**: `EstimatesService.convertToInvoice()` creates a Phase 2 `SalesDocument` (`documentType: INVOICE`) with a new nullable `garageJobId` FK, rather than a parallel garage-invoice model. Only `APPROVED` estimate lines are billed.
- **Parts/lubricants consumption**: see §1 — no new stock-mutation path.
- **Workshop inventory requests**: `WorkshopInventoryRequestsService.linkToRecommendations()` re-runs Phase 2's `PurchaseRecommendationsService.generate()`/`TransferRecommendationsService.generate()` and links to whatever `PENDING` recommendation matches the requested item+warehouse — no new reorder-quantity logic exists in Phase 3.
- **Audit**: domain-specific append-only trails (`JobStatusHistory`, `JobTimeline`, `ApprovalHistory`, `EstimateRevision`) are used everywhere one exists; Phase 2's generic `AuditService.log()` is used only where no domain-specific trail exists yet (`RepeatRepairService.resolve()`).

## 4. Module layout

`checklists`, `reception`, `garage-jobs`, `inspections`, `diagnostics`, `estimates`, `garage-inventory`, `labour`, `technicians`, `quality-control`, `vehicle-lifecycle` (digital twin, timeline, repeat-repair), `notifications`, `workshop-analytics`, `workshop-inventory-requests` — one NestJS module per bounded concern, matching Phase 2's pattern (`src/app.module.ts`).

## 5. Sub-domain documents

- [job-workflow.md](job-workflow.md) — the 19-state job status machine.
- [inspection-engine.md](inspection-engine.md)
- [diagnostic-model.md](diagnostic-model.md)
- [labour-engine.md](labour-engine.md)
- [vehicle-history.md](vehicle-history.md) — Digital Twin and Vehicle Timeline.
- [repeat-repair.md](repeat-repair.md)
- [garage-rbac.md](garage-rbac.md)
- [quality-control.md](quality-control.md)
- [decision-log-phase3.md](decision-log-phase3.md)

## 6. What's deliberately not here yet

No Swagger/OpenAPI documentation generation exists for either Phase 2 or Phase 3 — endpoints follow Phase 1/2's REST conventions but aren't machine-documented. No real authentication (still the `x-user-role`/`x-branch-id`/`x-warehouse-id` header stand-in — see [garage-rbac.md](garage-rbac.md)). No AI/ML anywhere in Phase 3 — DTCs are stored, not interpreted (see [diagnostic-model.md](diagnostic-model.md)); Digital Twin's `predictedMaintenance`/`aiConfidenceScore` are always `null`, reserved for Phase 4/5 (see [03-ai-platform.md](03-ai-platform.md)).
