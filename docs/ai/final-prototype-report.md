# DGX Prototype 1 — Final Prototype Report: Automotive Catalogue RAG

## Final Acceptance Pass (this session)

A dedicated final-acceptance pass was run on top of the completed implementation: full validation pipeline (Prisma validate/migrate status, `tsc --noEmit`, ESLint, production build, unit suite, integration suite, verification script — see [operational-runbook.md](operational-runbook.md) for the exact commands and real timings), plus — new this pass — **the platform was actually started and exercised live** rather than only through scripts:

- Real backend boot on `http://127.0.0.1:3900` (the repo's `.env` default port 3000 was found occupied by an unrelated process on this shared machine — worked around via `PORT=3900`, not by editing the committed default). `GET /health` returned `{"status":"ok", "dependencies":{"database":{"ok":true},"redis":{"ok":true},"dgx":{"ok":true}}}` — all three real dependencies healthy simultaneously.
- A real user was registered and logged in (`POST /auth/register` → `POST /auth/login`), producing a real JWT, which was then used to call `POST /catalogue/search` (real exact-OEM match returned) and `POST /catalogue/rag/ask` (real generation, real citations, `confidence: MEDIUM`) against the **live HTTP server** — not just via `NestFactory.createApplicationContext()` scripts as in prior passes.
- Negative-auth checks: no token and a malformed token were both correctly rejected (`403`); a SQL-injection-shaped query string was handled safely (parameterized, empty result, no error, `Part` table confirmed intact afterward).
- Real operational latency samples: deterministic `/catalogue/search` — 15 samples, P50 ≈ 15.0ms, P95 ≈ 18.4ms, P99 ≈ 19.5ms. Generative `/catalogue/rag/ask` — 3 samples (43.3s, 53.3s, 63.4s) measured *while the full integration suite was concurrently running in the background*, so these are pessimistic/contended numbers, reported as such rather than presented as a clean baseline.
- Full service inventory, endpoint inventory, and Swagger inventory produced from real, directly-checked process/port/HTTP state — see [service-inventory.md](service-inventory.md), [endpoint-inventory.md](endpoint-inventory.md), [swagger-inventory.md](swagger-inventory.md).
- A real, previously-undocumented security finding surfaced during this pass: `POST /auth/register` returns the full `User` row including `passwordHash` and `mfaSecretEncrypted` in the response body — a pre-existing identity-platform issue (not introduced by this phase), flagged here and in [security-and-access.md](security-and-access.md) rather than silently fixed (out of this phase's scope, which is verification, not identity-platform changes).
- Real database state re-confirmed: 3 `CatalogueIndexVersion` rows exist (v1, v2 both `RETIRED` — the two earlier builds from this project's own bug-discovery-and-fix cycle — and v3 `ACTIVE`, 120 real documents, 271 real `KnowledgeChunk` rows). `AiInferenceLog` has 576 total rows accumulated across this entire project's session — 219 of the "failures" in that historical total are fully explained (the now-fixed rate-limiting bug's ~200 dropped calls, plus a handful of intentional DGX-unreachable calls from the fallback test); the last 30 minutes of real live activity show 8/8 calls succeeding, 0 failures.

This pass reaffirms, and does not change, the readiness decision below — no new architectural or generation-quality issue was found by going live; the live run behaved exactly as the scripted verification runs predicted.

### Addendum — full platform integration suite status

The full-platform `npm run test:integration` run started during this acceptance pass (covering every real-DGX-touching integration spec across the whole codebase, not just catalogue-ai) was left running in the background for several hours without completing. Investigating why: several *targeted* integration runs (`--testPathPattern=catalogue-ai`, `--testPathPattern=identity`) were subsequently launched in the same session to verify specific fixes — each of those is a separate `jest` process, and each one's `test-global-setup-integration.ts` **truncates the entire shared integration test database** at its own start. That means the original full-suite run was left executing against a test database that got wiped out from under it multiple times after it began, invalidating whatever result it would eventually have produced. It was terminated rather than left to finish and potentially report a misleading pass/fail count.

This is an honest process-management finding, not a code defect: **never run a second `--testPathPattern`-scoped integration invocation while a full, unscoped integration run is still in progress** — they share one database and the global setup's truncate-on-start makes them mutually destructive. Every *targeted* rerun performed after this incident (catalogue-ai's own 5 integration spec files, 30/30 passing on the most recent clean run; identity's 13 tests, all passing) was run to completion in isolation and is trustworthy. A fresh, full, uninterrupted `npm run test:integration` pass is scheduled as part of this project's next tuning phase's own final checkpoint, and its real result will be reported then rather than fabricated here.

## Readiness decision: **NEEDS_TUNING**

Per the spec's own hard rule ("Do not declare production readiness if thresholds are not met"): one real acceptance threshold measurably fails (unsupported technical claims, §28 target <2%, real measurements of 33.3% and 50% across two full verification runs on a small sample). The deterministic search/safety architecture is solid and could reasonably be described as pilot-ready on its own; the generative layer needs real tuning work before the system as a whole should enter internal pilot. This report does not round up.

## What works (real, executed evidence)

- **Exact-identifier retrieval**: OEM, internal code, alternate number, TecDoc id, formatting-variation tolerance — all real, deterministic, zero DGX dependency. Self-consistency evaluation: Recall@1/3/5 = 1.0, MRR = 1.0, nDCG@5 = 1.0, exact-number preservation = 1.0 (20-part real sample).
- **Hybrid ranking never lets semantic similarity outrank an exact match** — structurally guaranteed by tier ordering, not tuning (`hybrid-ranking.spec.ts`).
- **Category-conflict-aware indexing**: a real category conflict is excluded from the clean corpus; a brand-only difference (expected multi-supplier coverage) is indexed with a visible review flag, not silently as fact.
- **Product comparison** never claims interchangeability without real evidence — verified across 11 real integration-test scenarios (`product-comparison.integration-spec.ts`).
- **No-answer / ambiguous-query honesty**: a real nonexistent part number and a real vague query both produced honest low-confidence responses, no fabricated matches. No-answer precision = 1.0.
- **Manual-review handoff and feedback capture** both work end-to-end against real data; the assistant never finalizes a review decision (verified: every verify/reject path requires a real reviewer id).
- **DGX-unavailable fallback**: deterministic search kept working with a genuinely unreachable DGX endpoint; the semantic path degraded honestly (`INSUFFICIENT_EVIDENCE`, `usedGeneration: false`) rather than crashing or corrupting data.
- **Blue-green index lifecycle**: a real flawed index build (see below) was retired, not deleted or overwritten; a corrected rebuild was activated cleanly.
- **Source systems unchanged**: `Part`/`LubricantProduct` row counts identical before and after every verification run — zero canonical writes from this module.
- **Test suite preserved and extended**: all pre-existing tests still pass; this phase added 6 pure-function unit-test files and 5 real-Postgres integration-test files (30 new integration tests, all passing) on top of them.

## What needs tuning before pilot

- **Generation groundedness is real but weak, and not yet stable run-to-run**: two full verification runs measured `avgGroundedness: 0.1999`/`0.1838` and `avgUnsupportedClaimRate: 0.3333`/`0.5` on the same small sample (3 generative cases, real LLM sampling at `temperature: 0.1`). This is the honest headline finding of this prototype — the deterministic layer is strong and stable, the generative layer needs real prompt/retrieval tuning (likely: better chunk granularity, stricter citation-grounding instructions, possibly a larger/better instruction model) and a larger evaluation sample before it should be trusted for real user-facing answers.
- **Only one embedding model and one LLM available in this environment** (`nomic-embed-text`, `llama3`) — the spec's multi-model comparisons could not be genuinely executed. This is an environment limitation, not a design gap; extending it is mechanical (pull additional models, re-run the same harness).
- **Offline evaluation sample is small** (28 cases, only 3 exercising the generative path). A larger, more adversarial evaluation set is needed before the generation-quality numbers above can be trusted as representative.
- **Citation correctness (1.0) validates a structural guarantee, not text-level citation accuracy** — see [source-citations.md](source-citations.md). A real in-line-citation-parsing check is a real gap.
- **No role-specific field-level redaction layer** beyond the existing all-or-nothing `parts.read`/`lubricants.read` gate.
- **No catalogue-corpus-embedded prompt-injection adversarial test** was run (only the pre-existing sanitizer unit tests and catalogue-level ambiguous/no-answer probes).
- **Only a representative sample of the real catalogue was indexed** (120 of ~8,157 real eligible items, due to real, measured embedding throughput of ~2.1s/item under the real rate limiter) — a full corpus build is a real multi-hour job, not yet executed.

## Which queries performed poorly

The generative-path cases (ambiguous query, no-answer query, one description query) showed the groundedness/unsupported-claim weaknesses above. Every deterministic-path case (exact OEM, formatted variation) performed at 100% across all retrieval metrics.

## Which conflicts remain

Zero real category-level conflicts were found within the representative sample actually indexed in the most recent verification run (the sample's one multi-source part had a brand-only difference, correctly not flagged). A real category conflict does exist elsewhere in the full catalogue (used as the offline-evaluation `CONFLICT` case) and was correctly detected and excluded from the clean corpus when encountered.

## Which data was excluded

Corpus-eligibility exclusions in the most recent 120-document build: 116 `INDEX_ELIGIBLE`, 4 `MANUAL_REVIEW_REQUIRED` (brand-only differences, indexed with a warning), 0 `EXCLUDED_CONFLICT`, 0 `EXCLUDED_LOW_QUALITY`, 0 `EXCLUDED_MISSING_IDENTITY`.

## Was DGX actually used

Yes — real `nomic-embed-text` embeddings (120 real documents, CPU-only, ~2.09s/document paced) and real `llama3` generations (multiple real calls across the verification run and integration tests) against the real local Ollama-backed DGX service. No mocked or simulated model responses appear anywhere in this phase's test suite or verification script.

## Is this ready for internal pilot

Not yet, as a whole system — the generative layer's real, measured groundedness/hallucination-proxy numbers do not clear the spec's own acceptance thresholds. The deterministic search, safety architecture (no automatic writes/merges, honest no-answer behavior, graceful DGX-unavailable degradation, manual-review-only finalization), and index-lifecycle machinery are real, tested, and could reasonably support a narrowly-scoped pilot (exact-identifier search only, generative answers disabled or clearly labeled experimental) if the business wants to move incrementally rather than wait for full tuning.

**Recommendation**: NEEDS_TUNING on the generative layer specifically before a full pilot; the deterministic layer is real and could be piloted narrowly today if desired. Per the spec's own instruction, the Demand Forecasting Prototype should not begin until this decision and report are reviewed.

## Official metrics (final acceptance pass)

**Corpus**: 7,723 real parts + 434 real lubricant products discovered (full catalogue); 120 indexed in the active representative sample (80 parts + 40 lubricants); 116 `INDEX_ELIGIBLE`, 4 `MANUAL_REVIEW_REQUIRED`, 0 excluded; corpus version = `CatalogueIndexVersion` v3; index status = `ACTIVE`.

**Embeddings**: 120 expected (this sample) → 120 generated successfully, 0 failed on the final paced run (an earlier, unpaced run failed ~200/230 — the bug that led to the pacing fix; see [vector-index-lifecycle.md](vector-index-lifecycle.md)); model `nomic-embed-text`, version 1; historical cumulative total across this project's sessions: 318 successful, 219 failed (all explained — rate-limit bug now fixed, plus intentional fallback-test failures).

**Retrieval** (self-consistency dataset, 28 cases): exact-OEM accuracy 100%, internal-code/alternate-number retrieval real and deterministic but not separately isolated in this dataset's metric breakdown (no internal-code/alternate-number self-consistency cases were included this pass — a real dataset-coverage gap, not a claimed-untested pass), Recall@1/3/5 = 1.0, Recall@10 not separately computed (dataset's top-K never exceeds 5), MRR = 1.0, nDCG@5 = 1.0, no-answer precision = 1.0, conflict-detection accuracy = 1.0.

**Generation**: groundedness 0.1838-0.1999 (two runs), citation correctness 1.0 (structural guarantee — see [source-citations.md](source-citations.md)), citation completeness not separately measured this pass, unsupported-claim rate 0.333-0.5 (two runs — below the <2% acceptance target), structured-output validity 1.0, confidence calibration not formally studied (discrete bands only, no calibration curve — see [confidence-model.md](confidence-model.md)).

**Operational**: P50/P95/P99 for deterministic search ≈ 15.0ms/18.4ms/19.5ms (15 real samples); generative endpoint 43.3s-63.4s under real concurrent load (3 samples, contended — not a clean baseline); error rate over the last 30 real minutes of live operation = 0/8 = 0%; timeout rate = 0 observed; fallback rate = deliberately 100% during the dedicated DGX-unavailable test, 0% otherwise; requests processed (cumulative `AiInferenceLog`) = 576; active index version = v3; active model versions = `nomic-embed-text:latest` (EMBEDDING, default, ACTIVE), `llama3:latest` (GENERATION, default, ACTIVE).

## Final Acceptance Q&A

1. **Which services are currently live?** Operational Core backend (`:3900`), DGX/Ollama (`:8800`, proxying Ollama on `:11434`), PostgreSQL (`:55432`), Redis/Memurai (`:16379`), and two Web Portal dev-server instances (`:5174`, `:5180`). Full detail: [service-inventory.md](service-inventory.md).
2. **What is the URL of every running application?** See [service-inventory.md](service-inventory.md)'s table — backend `http://127.0.0.1:3900`, DGX `http://127.0.0.1:8800`, portal `http://localhost:5174` / `http://localhost:5180`.
3. **What is the URL of every Swagger/OpenAPI endpoint?** One consolidated document: `http://127.0.0.1:3900/api-docs` (UI), `http://127.0.0.1:3900/api-docs-json` (JSON). No separate Swagger exists for the DGX service or Catalogue AI specifically. See [swagger-inventory.md](swagger-inventory.md).
4. **Which AI model is currently serving requests?** `llama3:latest` for generation, `nomic-embed-text:latest` for embedding — both real, both `ACTIVE` and default in the `AiModel` registry, both confirmed serving real requests this session.
5. **Which index version is active?** `CatalogueIndexVersion` v3 (120 real documents; v1 and v2 are `RETIRED`, real historical builds preserved, not deleted).
6. **Is the prototype ready for an internal pilot?** Not as a whole system — see readiness decision above (**NEEDS_TUNING**, generation-quality thresholds not yet cleared). The deterministic-search layer alone is real, tested, and could support a narrowly-scoped pilot today if the business wants to move incrementally.
7. **What remaining work is required before production deployment?** (a) Improve generation groundedness/unsupported-claim rate below the 2% threshold — likely prompt/retrieval tuning and a larger evaluation sample; (b) evaluate a second embedding model and a second LLM once available in this environment; (c) build the full real corpus (currently a 120-item representative sample of ~8,157 eligible real items); (d) add role-specific field-level redaction beyond the current all-or-nothing permission gate; (e) fix the pre-existing `passwordHash`/`mfaSecretEncrypted` response-leak in `POST /auth/register` (identity platform, not this phase's code, but a real blocker for any pilot with real user accounts); (f) run a catalogue-corpus-embedded prompt-injection adversarial test; (g) deploy Grafana (or equivalent) against the already-live Prometheus metrics if operational visibility is needed beyond raw scrape data.
