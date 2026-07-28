# Vehicle History: Digital Twin and Timeline

Two related but distinct read models, both in `src/vehicle-lifecycle/`, both **computed on demand from existing tables — neither is a new mutable data store.**

## Why computed, not stored

Every field the spec asks the Digital Twin to expose (repair history, DTCs, parts, lubricants, technicians, inspections, complaints, cost of ownership, warranty history) already exists as a row somewhere else in the schema — `GarageJob`, `DiagnosticCode`, `GarageJobLine`, `JobAssignment`, `InspectionResult`, `CustomerComplaint`, `SalesDocumentLine`, `RepeatRepairFlag`. Storing a second, denormalized "twin" table would mean keeping it in sync with all of those on every write — a duplication and drift risk for no benefit, since none of this needs to be pre-aggregated at write time. `VehicleDigitalTwinService.getDigitalTwin(vehicleId)` just reads and assembles.

## Digital Twin (`digital-twin.service.ts`)

`getDigitalTwin(vehicleId)` runs its reads in parallel (`Promise.all`) and returns:

| Field | Source |
|---|---|
| `identity` | `Vehicle` (VIN, registration, brand/model/variant, engine code, decode confidence) |
| `attributeChangeHistory` | `Vehicle.attributeHistory` (Phase 1) |
| `ownershipHistory` | `Vehicle.customerLinks` (Phase 2 `CustomerVehicleLink`) |
| `repairHistory` | every `GarageJob` for the vehicle |
| `dtcHistory` | every `DiagnosticCode` across every job's diagnostic sessions |
| `partsReplaced` | every `GarageJobLine` with `lineType: PART` |
| `lubricantsUsed` | every `GarageJobLine` with `lineType: LUBRICANT` |
| `techniciansInvolved` | distinct technicians across every `JobAssignment` |
| `inspectionHistory` | every `InspectionResult` across every job |
| `complaintHistory` | every `CustomerComplaint` for the vehicle |
| `costOfOwnership` | sum of `SalesDocumentLine.lineTotal` where `vehicleId` matches (real invoices only — see below) |
| `warrantyHistory` | jobs where `isWarranty` is true |
| `repeatRepairFlags` | `RepeatRepairFlag` rows for the vehicle |
| `predictedMaintenance`, `aiConfidenceScore` | **always `null`** — Phase 4/5 placeholders, never fabricated |

## Cost of ownership is a real number, not a stub

`costOfOwnership.totalInvoiced` only reflects money actually invoiced: `EstimatesService.convertToInvoice()` (see [phase-2-commercial-foundation.md](phase-2-commercial-foundation.md) for the reused `SalesDocument` model) creates a real `SalesDocument` with `garageJobId` set, billing only the estimate lines a customer actually approved. Before that method existed and was wired into the verification flow, this figure was structurally always zero — nothing ever created an invoice tied to a job. It's a read of real committed sales data, not an estimate total (a customer-rejected line never appears here).

## Vehicle Timeline (`vehicle-timeline.service.ts`)

`getTimeline(vehicleId)` merges two append-only sources and sorts by `occurredAt`:
- `VehicleReception.arrivalAt` — one `VEHICLE_RECEIVED` entry per check-in.
- `JobTimeline` rows across every job the vehicle has ever had — status changes, technician assignments, part reservations/issues/returns, and anything else that writes to `JobTimeline` (see [job-workflow.md](job-workflow.md)).

Like the Digital Twin, this is a merge-and-sort over existing rows, not a separately maintained table — the underlying `JobTimeline`/`VehicleReception` rows are the actual source of truth.

## Verification

`vehicle-lifecycle.integration-spec.ts` checks the Digital Twin aggregates correctly across multiple jobs and that the timeline merges chronologically across job and reception boundaries.
