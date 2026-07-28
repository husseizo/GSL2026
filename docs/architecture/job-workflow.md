# Job Workflow

`src/garage-jobs/job-workflow.ts` — the single, pure, DB-free definition of the `GarageJob` state machine. `JOB_STATUS_TRANSITIONS: Record<GarageJobStatus, GarageJobStatus[]>` is the entire ruleset; `canTransition()`/`assertValidTransition()` are the only ways any code checks or enforces it. Exhaustively unit tested in `job-workflow.spec.ts` (11 tests, including a check that every `GarageJobStatus` enum value has an entry in the map).

## The 19 states

`DRAFT → CHECKED_IN → WAITING_INSPECTION → INSPECTION_IN_PROGRESS → WAITING_ESTIMATE → WAITING_CUSTOMER_APPROVAL → (PARTIALLY_APPROVED | APPROVED) → WAITING_PARTS → READY_TO_START → IN_PROGRESS → (PAUSED | WAITING_ADDITIONAL_APPROVAL | QUALITY_CONTROL) → ROAD_TEST → READY_FOR_COLLECTION → COMPLETED`, plus `CANCELLED` and `WARRANTY_RETURN`.

## Notable transitions that aren't a straight line

- **`IN_PROGRESS` can go to `QUALITY_CONTROL` directly** (skipping `PAUSED`/`WAITING_ADDITIONAL_APPROVAL`) — those two are optional detours, not required stops.
- **QC/road-test failure loops back to `IN_PROGRESS`**, not to a dead end or an error state — both `QUALITY_CONTROL` and `ROAD_TEST` can transition back to `IN_PROGRESS` for rework. Failing QC is a normal outcome the workflow has to model, not an exceptional one.
- **`COMPLETED → WARRANTY_RETURN → WAITING_INSPECTION`** — a warranty return reopens at inspection, not at `CHECKED_IN`. The vehicle is already known and already physically received; it needs re-diagnosis, not a second check-in.
- **`CANCELLED` is terminal** (`[]`) but reachable from almost every other state — a job can be cancelled at nearly any point, but once cancelled nothing transitions it further.

## Enforcement

`GarageJobsService.transition()` (`src/garage-jobs/garage-jobs.service.ts`) calls `assertValidTransition(job.status, dto.newStatus)` before doing anything else; an illegal transition throws `IllegalJobTransitionError` (carrying `from`/`to` for the caller) and the job row is never touched. Verified against a real database in `garage-jobs.integration-spec.ts` ("rejects an illegal transition and leaves the job status unchanged").

## Every transition is an audit event, not an edit

A successful `transition()` call, inside one `$transaction`:
1. Updates `GarageJob.status` (and `closedAt` if the new status is `COMPLETED`).
2. Inserts a new `JobStatusHistory` row — `previousStatus`, `newStatus`, `changedById`, `reason`, `correlationId`, `changedAt`. Never updates an existing history row.
3. Inserts a new `JobTimeline` row (`eventType: 'STATUS_CHANGED'`) so the transition also appears in the vehicle's chronological [timeline](vehicle-history.md).
4. Conditionally creates a `NotificationEvent` — `VEHICLE_READY` on `READY_FOR_COLLECTION`, `APPROVAL_REQUIRED` on `WAITING_CUSTOMER_APPROVAL`.

`JobStatusHistory` and `JobTimeline` are append-only by construction: nothing in the codebase calls `.update()` or `.delete()` on either model. This is what "no silent edits" means concretely for job cards.

## Completion-readiness checks

Entering either `READY_FOR_COLLECTION` or `COMPLETED` (`COMPLETION_STATUSES`) triggers `GarageJobsService.checkCompletionReadiness()`, which flags (via `DataQualityService.record()`, `MANUAL_REVIEW`, never blocking) three conditions: `missing_quality_control` (no passing `QualityInspection`), `missing_road_test` (no passing `RoadTest`), `missing_estimate_approval` (no `Estimate` with status `APPROVED` or `PARTIALLY_APPROVED` — including the case of *zero* estimates at all, which is at least as clearly "missing" as a rejected one). See [quality-control.md](quality-control.md) and [data-quality-phase-2.md](data-quality-phase-2.md).

## Duplicate job cards and vehicle mismatch

`GarageJobsService.create()` checks, before creating: (a) if a `receptionId` is supplied, that its `vehicleId` matches the requested job's `vehicleId` (`vehicle_mismatch` if not); (b) whether the vehicle already has an open job card in any non-`COMPLETED`/non-`CANCELLED` status (`duplicate_job_card` if so). Both are `MANUAL_REVIEW` flags, not hard rejections — the job is still created, since a supervisor may have a legitimate reason (e.g. a second, unrelated concurrent job), but it's visible for review.
