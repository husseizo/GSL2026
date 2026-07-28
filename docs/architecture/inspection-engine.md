# Vehicle Inspection Engine

`src/inspections/` — configurable, template-driven inspection with structured findings, distinct from the generic checklist engine (see [garage-architecture.md §2](garage-architecture.md)) because an inspection result carries more than a pass/fail tick: severity, recommended action, required parts/lubricants, and a safety-warning flag.

## Templates

`InspectionTemplate` → `InspectionSection` (ordered, e.g. "Engine", "Brakes") → `InspectionItem` (ordered, e.g. "Front pads", "Belt"). `InspectionsService.createTemplate()` creates all three levels in one nested write. Templates are reusable across jobs — a job doesn't get its own copy of the template, it just references `InspectionItem` rows when recording results.

## Results

`InspectionResult` — one row per `(jobId, itemId)`, enforced by `@@unique([jobId, itemId])`. `finding` is one of `PASS`/`WARNING`/`FAIL`/`NOT_INSPECTED`/`UNKNOWN`; also carries `severity`, `recommendedAction`, `estimatedLabourMinutes`, `requiredPartId`, `requiredLubricantProductId`, and `safetyWarning`.

**Re-recording upserts, it doesn't duplicate.** `InspectionsService.recordResult()` calls `prisma.inspectionResult.upsert()` on the `(jobId, itemId)` key — a technician correcting an earlier finding (e.g. `WARNING` → `FAIL` after a closer look) updates the same row in place rather than creating a second one. This is a deliberate difference from `JobStatusHistory`/`JobTimeline` (append-only): an inspection result is the *current* assessment of one specific item, not a history of assessments — the DB unique constraint is what makes "one row per item" structurally guaranteed rather than just a convention. Verified in `inspections.integration-spec.ts` ("re-recording a result for the same job+item upserts in place rather than duplicating").

## Photos

`InspectionPhoto` attaches to a specific `InspectionResult` (`addPhoto()`), not to the job generically — a photo of failed brake pads is tied to the brake-pad finding, not floating in a generic job photo bucket. (`VehiclePhoto`, on `VehicleReception`, is the separate check-in-time photo set — condition-at-arrival, not a per-finding photo.)

## Reading results

`listResultsForJob()` returns every result with its item/section/photos/required-part/required-lubricant. `listFailedForJob()` filters to `finding: 'FAIL'` only — this is what a service advisor or the completion-readiness check would use to see what actually needs attention, without re-filtering the full result set client-side.

## Feeds into

- **Digital Twin** (`VehicleDigitalTwinService.getDigitalTwin()`) aggregates every `InspectionResult` across all of a vehicle's jobs into `inspectionHistory` — see [vehicle-history.md](vehicle-history.md).
- **Repeat-repair detection** does not currently use inspection findings as a match signal (it uses complaint/DTC/part/system-category — see [repeat-repair.md](repeat-repair.md)); a future phase could extend the signature to include recurring `FAIL` items on the same `InspectionItem`.
