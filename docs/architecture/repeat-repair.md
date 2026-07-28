# Repeat Repair Detection

`src/vehicle-lifecycle/repeat-repair-math.ts` (pure, unit-tested) + `repeat-repair.service.ts` (DB orchestration). Deterministic matching only — **no AI required**, per the spec, and none used.

## Signals and priority

A `JobRepairSignature` is built per job: normalized complaint descriptions, DTC codes, part IDs, and part categories (`normalizeComplaint()` lowercases/trims/collapses whitespace so "Rough Idle " and "rough idle" match). `detectRepeatRepairs(current, priorJobs)` compares the current job's signature against every prior job for the same vehicle within a lookback window (default 180 days, `DEFAULT_WINDOW_DAYS`) and records **one match per prior job**, using the strongest available signal in priority order:

1. `SAME_COMPLAINT` — same normalized customer complaint text.
2. `SAME_DTC` — same diagnostic trouble code.
3. `SAME_PART` — same exact part replaced.
4. `SAME_SYSTEM` — same part *category* (e.g. both jobs touched something in "Cooling System"), the weakest/broadest signal.

Priority order matters: a pair of jobs that share both a complaint and a DTC is recorded once, as `SAME_COMPLAINT` (the strongest signal), not twice — avoiding redundant flags for the same underlying relationship.

## Persistence and idempotency

`RepeatRepairService.detectForJob(jobId)` upserts `RepeatRepairFlag` on the unique key `(jobId, relatedJobId, matchReason)` — added via a follow-up migration (`20260711040000_repeat_repair_unique`, applied non-interactively via `prisma migrate diff --script` + `migrate deploy` since `migrate dev` wouldn't apply a unique-constraint addition without an interactive confirmation). Re-running detection for the same job is a no-op for pairs already flagged — verified in `vehicle-lifecycle.integration-spec.ts` ("repeat-repair dedup on re-run via unique key").

## Status and warranty escalation

`RepeatRepairFlag.status`: `POSSIBLE` (default) → `CONFIRMED` or `WARRANTY_CANDIDATE`, set via `RepeatRepairService.resolve()`. If the *current* job (the one triggering detection) `isWarranty`, new flags are created directly as `WARRANTY_CANDIDATE` rather than `POSSIBLE` — a repeat repair on a warranty job is a strong enough signal on its own to skip the "possible" stage.

## Resolution and audit

`resolve(id, status, resolvedById, note)` is the one Phase 3 mutation that goes through Phase 2's generic `AuditService.log()` instead of a dedicated history table — unlike job transitions, approvals, or estimate revisions, a repeat-repair resolution doesn't have (and doesn't need) its own append-only trail; the generic audit log already exists for exactly this kind of occasional, low-volume state change. See [decision-log-phase3.md](decision-log-phase3.md).

## Feeds into

Digital Twin's `repeatRepairFlags` field (see [vehicle-history.md](vehicle-history.md)); workshop analytics' repeat-repair counts.
