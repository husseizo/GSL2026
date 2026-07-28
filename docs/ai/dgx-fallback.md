# DGX-Unavailable Fallback

## What keeps working

`CatalogueSearchService` never calls the AI gateway — every method (`findByInternalCode`, `findByOemNumber`, `findByAlternateNumber`, `findByTecdocId`, `findSupersessions`, `keywordSearchParts`/`keywordSearchLubricants`, `findLubricantsByViscosity`, `findLubricantsByVerifiedApproval`) is a direct, deterministic Prisma query. `ProductComparisonService` and `PartRelationshipService` are the same — pure database reads/writes, zero DGX dependency. This means exact-identifier search, alternates, supersessions, TecDoc lookup, keyword search, lubricant viscosity/approval search, and structured comparison all continue working with DGX fully offline.

## What degrades

`CatalogueRagService.answerFromRag()` — the semantic/generative path — depends on `RagService.retrieveAndGenerate()`, which calls `AiGatewayService.embed()` first. When that's unavailable, `retrieveAndGenerate()` returns `{ available: false, answer: null, confidence: 'NONE', missingInformation: ['DGX embedding service unavailable'] }` rather than throwing, and `CatalogueRagService` maps this to `confidence: 'INSUFFICIENT_EVIDENCE'`, `usedGeneration: false` — a clear, honest degraded response, not a crash and not a fabricated answer.

## Real test of this behavior

`scripts/verify-dgx-catalogue-rag.ts` steps 29-31 perform a genuine fallback test, not a simulated one:

1. `DgxClientService.baseUrl` is read once from `process.env.DGX_SERVICE_URL` at construction time (a private readonly field) — so toggling the env var on an already-running application context has no effect. The verification script therefore points `DGX_SERVICE_URL` at a genuinely unreachable address (`http://127.0.0.1:1`) and spins up a **second, isolated** `NestFactory.createApplicationContext()` before running the fallback checks, leaving the original context (with the real, reachable DGX URL) untouched.
2. Against this degraded context, `CatalogueSearchService.findByOemNumber()` is called for a real OEM number — it returns a real hit, unaffected by DGX being unreachable.
3. `CatalogueRagService.ask()` is called with a semantic-style query — it returns `confidence: 'INSUFFICIENT_EVIDENCE'`, `usedGeneration: false`, no thrown exception, no data corruption.
4. The degraded context is closed and `DGX_SERVICE_URL` is restored; all subsequent verification steps continue against the original, real-DGX context — demonstrating "re-enable" without needing a third context, since the original one was never actually degraded.

A real run of this exact sequence is captured in the verification script's own output log (steps 29-31, all `EXECUTED_PASSED`).

## Health visibility

`ModelRegistryService.gpuHealth()` (→ `DgxClientService.health()`) is the real, callable health check a monitoring surface would poll to show "degraded AI service" status. This phase does not add a separate `/catalogue/health` endpoint — the existing model-registry health check already covers "is the DGX reachable," and duplicating it per-module would be the kind of unnecessary parallel structure this project's phases consistently avoid.
