# Digital Twin Intelligence

Extends Phase 3's [Vehicle Digital Twin](vehicle-history.md), which left `predictedMaintenance`/`aiConfidenceScore` as permanent-looking `null` placeholders explicitly reserved for Phase 4. `src/twin-intelligence/twin-intelligence-math.ts` is the pure, deterministic scoring module that fills them in for real — wired directly into `VehicleDigitalTwinService.getDigitalTwin()` (`digital-twin.service.ts`'s `computeIntelligence()` private method), not a separate query path.

## Why deterministic, not a trained model

The spec itself instructs: "Never assume deep learning is automatically better." This system's per-vehicle history is genuinely small — a handful of jobs, a handful of DTCs — nowhere near enough to train anything without either overfitting to a few rows or fabricating a confidence figure that isn't earned. Every score here is a rule applied to counted, real evidence, and every rule is stated in the code comment next to it, so a reviewer can recompute any number by hand from the same evidence list.

## System risk classification

`classifySystem()` keyword-matches free text (DTC descriptions, part names, failed/warning inspection findings, complaint text) into one of six systems: `COOLING`, `ENGINE`, `TRANSMISSION`, `SUSPENSION`, `ELECTRICAL`, `BRAKE`. `computeSystemRisks()` counts matching events in the trailing 12 months per system: `riskScore = min(100, count * 25)` — three or more incidents on the same system within a year is `HIGH`. Simple, explainable, and directly re-derivable.

## Scores produced

| Field | Formula | Notes |
|---|---|---|
| `healthScore` | `100 - average(systemRiskScores)` | 100 for a vehicle with zero risk evidence anywhere |
| `maintenanceRiskScore` | `average(systemRiskScores) + repeatRepairFlagCount * 10` | repeat repairs push this up independently of raw system risk |
| `serviceComplianceScore` | % of actual job-to-job intervals within 125% of a 180-day target | `null` with fewer than 2 dated service events (`INSUFFICIENT_HISTORY`) |
| `warrantyRiskScore` | `warrantyCandidateFlags * 30 + warrantyJobRatio * 40`, capped at 100 | driven by `RepeatRepairFlag.status = WARRANTY_CANDIDATE` and the vehicle's own warranty-job ratio |
| `predictedMaintenance` | one entry per non-LOW-risk system, ranked by evidence count | LOW-risk systems are omitted entirely, not padded with an empty "all good" entry |
| `predictedFutureParts` / `predictedLubricantNeeds` | projected next date = last occurrence + average real interval between past occurrences | requires 2+ real occurrences of the same part/lubricant on this vehicle — a part replaced once has no interval to average, and gets no prediction rather than a guessed one |
| `aiConfidenceScore` | bucketed by job count: `<2 → INSUFFICIENT_HISTORY`, `<5 → LOW`, `<10 → MEDIUM`, `10+ → HIGH` | gates every other score's trustworthiness — a HIGH-looking `healthScore` on a 1-job vehicle is still reported alongside a `LOW`/`INSUFFICIENT_HISTORY` confidence |

## Every prediction cites evidence

`predictedMaintenance` entries name the system, its risk level, and the real count of evidence events behind it ("3 related issue(s) in the last 12 months"). `predictedFutureParts`/`predictedLubricantNeeds` entries carry `occurrenceCount` and `averageIntervalDays` computed from real timestamps, not a generic manufacturer interval. This satisfies the spec's "every prediction must reference historical evidence" literally — the evidence is in the response object, not just in an internal log.

## APIs

`GET /ai/vehicle-health/:vehicleId` and `GET /ai/predict-maintenance/:vehicleId` (`src/twin-intelligence/twin-intelligence.controller.ts`) are thin slices of the same `getDigitalTwin()` call the full Digital Twin endpoint already makes — no separate aggregation or scoring path exists for these two endpoints.

## What changed in Phase 3's own tests

`vehicle-lifecycle.integration-spec.ts`'s existing digital-twin test asserted `predictedMaintenance === null` and `aiConfidenceScore === null` — the literal Phase 3 placeholder behavior. That assertion was deliberately updated (not left broken) to reflect the real Phase 4 values now produced for that same fixture (`predictedMaintenance: []`, `aiConfidenceScore: 'LOW'` for a 2-job vehicle with no repeated-system evidence) — an intentional, documented behavior change, not a regression.
