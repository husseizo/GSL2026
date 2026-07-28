# Quality Control

`src/quality-control/quality-control.service.ts` — final-stage inspection, road test, and customer-ready sign-off before a job can honestly claim it's done.

## Structure

- `QualityInspection` — `result: PASS | CONDITIONAL_PASS | FAIL`, with `QualityIssue` children (leaks, noise, warning lights, fluid levels, whatever the inspector records) and free-text `notes`.
- `RoadTest` — `driverId`, `distanceKm`, `result`, `notes`.
- `QualityApproval` — the final customer-ready sign-off (`approvedById`, `note`).

## Notifications are side effects of the result, not a separate step

`createInspection()` creates a `NotificationEvent` inline based on `result`: `QC_FAILED` if the inspection failed, `ROAD_TEST_REQUIRED` if it passed (or conditionally passed) — the road test is the very next expected step, so the notification fires as soon as QC clears rather than waiting for a separate trigger.

## `hasPassed()` — the single source of truth for "is this job actually ready"

`QualityControlService.hasPassed(jobId)` returns `{ hasQualityInspection, hasRoadTest, isCustomerReady }` — `true` only if a `PASS`/`CONDITIONAL_PASS` result exists (a `FAIL` doesn't count, even if a later attempt hasn't been recorded yet). This is the exact method `GarageJobsService.checkCompletionReadiness()` calls when a job moves toward `READY_FOR_COLLECTION`/`COMPLETED` — see [job-workflow.md](job-workflow.md). There's deliberately one method computing this, not a duplicated check in the job-workflow module, so QC and job-completion logic can't drift apart on what "passed" means.

## Issue resolution

`resolveIssue(issueId)` sets `resolvedAt` on a `QualityIssue` — a simple resolve, no dedicated history table (unlike `JobStatusHistory`/`ApprovalHistory`), since a QC issue's lifecycle is short-lived (raised during one inspection, resolved before the next) rather than something requiring a long-running audit trail.

## Feeds into

- [job-workflow.md](job-workflow.md)'s completion-readiness check (`missing_quality_control`, `missing_road_test`).
- Digital Twin's `inspectionHistory` is from the *inspection engine* (`InspectionResult`), a separate concept from `QualityInspection` — inspection engine results are diagnostic/pre-repair findings per checklist item; `QualityInspection` is the final post-repair quality gate. Workshop analytics reports both `qc.read`-gated failure counts and road-test/QC pass rates separately.
