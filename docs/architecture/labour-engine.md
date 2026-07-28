# Labour Engine and Technician Management

`src/labour/` (operations, categories, rates, time logs) and `src/technicians/` (technician identity, skills, certifications, availability, schedule) are separate modules — labour is *what work costs and how long it takes*, technicians are *who can do it and when*. `TechnicianTimeLog` is the join between them (references both a `Technician` and, optionally, a `LabourOperation`).

## Labour catalogue

`LabourCategory` → `LabourOperation` (`code`, `name`, `standardMinutes`, category) → `LabourRate` (`hourlyRate`, effective-dated, scoped to a specific `labourOperationId` and/or `branchId`, or neither for a system-wide default). `LabourService.getEffectiveRate()` picks the rate active `at` a given instant (`effectiveFrom <= at <= effectiveTo` or `effectiveTo IS NULL`), most-recent-`effectiveFrom`-first — so a rate change takes effect only going forward, and historical job costing isn't retroactively altered by a later rate update.

## Technician time logging

`TechnicianTimeLogService` (`src/labour/technician-time-log.service.ts`): `start()` / `pause()` / `resume()` / `end()`. `end()` computes `actualMinutes` from wall-clock `startedAt`→`endedAt` — the *actual* hours, compared elsewhere against `LabourOperation.standardMinutes` (the *estimated* hours) for utilization/productivity reporting.

**Overlapping technician assignment** is flagged, not blocked: `start()` checks for another `TechnicianTimeLog` on the same technician with `endedAt: null` (still open) and, if found, records an `overlapping_technician_assignment` `MANUAL_REVIEW` data-quality issue rather than rejecting the new log. A technician plausibly starting a second quick task while a first is still "open" (forgot to clock out) is common enough that hard-blocking would be more disruptive than helpful — a supervisor reviews the flag instead. Verified in `technician-time-log.integration-spec.ts`.

## Technician management

`Technician` → `TechnicianSkill` (`specialization` — `BMW`/`MERCEDES`/`LAND_ROVER`/`VAG`/`ELECTRICAL`/`HYBRID`/`EV`/`AUTOMATIC_TRANSMISSION`/`DIAGNOSTICS` etc., with a `proficiency` level, `@@unique([technicianId, specialization])`) + `TechnicianCertification` (name, issuer, issued/expiry dates) + `TechnicianAvailability` (per-date override) + `TechnicianSchedule` (recurring weekly slots).

**Skill-based assignment**: `TechniciansService.findBestMatch(branchId, specialization)` — deterministic ranking by `proficiency` descending among active technicians at the branch who hold that specialization. No AI/ML; this is the same "propose from real data, rank explicitly" pattern used everywhere else in the system (e.g. purchase/transfer recommendations).

## Feeds into

- `GarageJobsService.assignTechnician()` creates a `JobAssignment` (role `TECHNICIAN`/`SUPERVISOR`) and a `TECHNICIAN_ASSIGNED` notification.
- Digital Twin's `techniciansInvolved` (see [vehicle-history.md](vehicle-history.md)) is built from `JobAssignment` rows across all of a vehicle's jobs.
- Workshop analytics' technician-utilization and labour-revenue figures are computed from `TechnicianTimeLog`/`GarageJobLine` (lineType `LABOUR`) — see `src/workshop-analytics/workshop-analytics.service.ts`.
