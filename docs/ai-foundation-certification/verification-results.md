# AI Foundation Certification Sprint — Verification Results

Real output of `scripts/verify-ai-foundation-certification.ts` (spec §23). Every step is `EXECUTED_PASSED`/`EXECUTED_FAILED`/`SKIPPED` — never silently promoted to passing.

## First real run — found 2 real bugs in the verify script itself

The verify script's first execution genuinely failed 3 of 13 steps. Investigated directly, not waived:

| Step | Result | Root cause |
|---|---|---|
| 8 (Regression verification) | `EXECUTED_FAILED` — all fields `undefined` | The script read `latestFullRun.metrics.inputs.*`, but the real persisted shape (`run-real-certification-gate-check.ts`) is `{ category, metrics: <gate inputs>, gates, sampleSize, failedGates }` — the gate inputs are nested under the key `metrics`, not `inputs`. |
| 9 (Performance verification) | `EXECUTED_FAILED` — `p95 = undefined` | Same root cause as Step 8. |
| 13 (Documentation completeness) | `EXECUTED_FAILED` — missing `verification-results.md`, `final-report.md` | Correct and expected — these two docs (this one and the final report) are necessarily written *after* a real verify run exists to report on, and did not exist yet at that point. |

Steps 8 and 9's field-access bug was fixed (read `.metrics.metrics.*` instead of `.metrics.inputs.*`, confirmed directly against the real persisted `BenchmarkRun` row before fixing). This is reported here rather than silently corrected and re-run without a trace, per the sprint's own "no hidden failures" rule.

## Final, clean verify run

| Step | Outcome | Detail |
|---|---|---|
| 1. Verify build | EXECUTED_PASSED | Zero TypeScript errors. |
| 2. Verify lint | EXECUTED_PASSED | Zero ESLint errors. |
| 3. Run full test suite | EXECUTED_PASSED | 146/146 suites, 862/862 tests. |
| 4. Real gate sanity check (150-case sample) | EXECUTED_PASSED | Gold benchmark v2, Recall@1=0.9933, MRR=0.9933, IdentifierAccuracy=1.00. |
| 5. Full-dataset certification evidence | EXECUTED_PASSED | Real run against 1,851 cases, `gateStatus=PASS`, all mandatory gates PASS/WAIVED. |
| 6. Gold Dataset checksum | EXECUTED_PASSED | Benchmark v2 checksum matches (stored = recomputed). |
| 7. Knowledge Snapshot verification | EXECUTED_PASSED | Snapshot v15, `APPROVED` (not yet activated — an honest, separate operational step). |
| 8. Regression verification | EXECUTED_PASSED | wrongFitment=0, wrongSupersession=0, wrongLubricantApproval=0, restrictedLeakage=0. |
| 9. Performance verification | EXECUTED_PASSED | p95 latency real and within the 5,000ms threshold. |
| 10. Security / permission enforcement | EXECUTED_PASSED | Certification Dashboard routes behind the existing `PermissionsGuard`/`ai.evaluations.read` — no new guard introduced. |
| 11. Rollback verification | EXECUTED_PASSED | Every named fix (`{3,100}` length bounds, `ENGINE_CODE_ALPHA_PATTERN`, `looksLikeSegmentedIdentifier`) confirmed present as an independently-revertable diff. |
| 12. Certification Dashboard verification | EXECUTED_PASSED | Real render written to `docs/ai-foundation-certification/reports/latest.html`, zero external/CDN references. |
| 13. Documentation completeness | EXECUTED_PASSED | All 12 required docs exist and are non-empty. |

**13/13 steps EXECUTED_PASSED, 0 EXECUTED_FAILED, 0 SKIPPED.**

See [final-report.md](final-report.md) for the resulting readiness verdict.
