# Diagnostic Module

`src/diagnostics/` — structured storage for diagnostic sessions, DTCs, symptoms, and suspected causes. **No AI interpretation of DTCs happens anywhere in this module** — this is a direct, explicit spec requirement, not an oversight; see [03-ai-platform.md](03-ai-platform.md) for why AI is deliberately out of scope through Phase 3.

## Structure

- `DiagnosticSession` — one per diagnostic pass on a job (`jobId`, `startedAt`, `completedAt`, `proceduresPerformed` as a JSON step list).
- `DiagnosticCode` — a DTC recorded against a session: `code` (e.g. `P0301`), `source` (`MANUFACTURER_SPECIFIC` / `GENERIC_OBD` / `MANUAL_ENTRY`), free-text `description`, and `freezeFrame` (arbitrary JSON — whatever snapshot data the scan tool reported, stored as-is, never parsed or interpreted).
- `Symptom` — free-text, `reportedBy: 'TECHNICIAN' | 'CUSTOMER'`.
- `SuspectedCause` — `confidence: 'SUSPECTED' | 'CONFIRMED'`, optionally linked to the `DiagnosticCode` that led to it. `DiagnosticsService.confirmCause()` is the only way a cause becomes `CONFIRMED` — always an explicit human action (`confirmedById`, `confirmedAt`), never inferred.
- `DiagnosticAttachment` — scan-tool exports, photos of freeze-frame screens, etc.; just a URL + kind, no processing.

## Why "store structured information" is taken literally

`freezeFrame` is a raw JSON blob, not a set of named columns — because what a scan tool reports varies by manufacturer and tool, and normalizing it into columns would mean guessing at a schema the spec explicitly didn't ask for. `DiagnosticsService` has no method that reads or branches on DTC *meaning* (what a `P0301` implies, what part it suggests) — that reasoning is left entirely to the technician recording `SuspectedCause`/`recordProcedure()` by hand. This is the boundary Phase 4/5 AI work would sit on top of, not replace.

## Vehicle-level DTC history

`DiagnosticsService.listCodeHistoryForVehicle(vehicleId)` aggregates every `DiagnosticCode` across every `DiagnosticSession` on every job the vehicle has ever had — verified in `diagnostics.integration-spec.ts` across two separate jobs. This is the same aggregation `VehicleDigitalTwinService` performs independently for `dtcHistory` (see [vehicle-history.md](vehicle-history.md)); both read from the same underlying rows, neither duplicates the other's storage.

## Feeds into

Repeat-repair detection's `SAME_DTC` signal (`src/vehicle-lifecycle/repeat-repair-math.ts`) uses `DiagnosticCode.code` — see [repeat-repair.md](repeat-repair.md).
