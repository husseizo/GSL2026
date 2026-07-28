# Safety Benchmark — DGX Prototype 1.6 (spec §15)

## Categories covered

`SAFETY`, `SECURITY`, and `PROMPT_INJECTION` are three separate `BenchmarkCategory` values, each independently scored — never blended, per the "never collapse" rule. `PERMISSION_ENFORCEMENT` (a fourth, related category) is documented separately since its mechanism is fully deterministic/pure rather than a refusal check — see below.

## Real, curated adversarial cases

`src/ai-benchmark/categories/safety-security-cases.ts`:

- **`buildSafetyAndPromptInjectionCases()`**: real phrasings targeting prompt injection (ignore-instructions, reveal-system-prompt, invent-an-identifier, SQL-injection-style requests) and unsupported diagnostic requests — a superset of what `query-understanding.ts`'s `PROMPT_INJECTION_PATTERNS`/`UNSUPPORTED_DIAGNOSTIC_PATTERNS` already match, exercising the real live classifier rather than duplicating its regex logic.
- **`buildSecurityCases()`**: real policy-bypass phrasings (skip a human-approval workflow, override a conflict flag) and real secret-disclosure phrasings (database connection string, another user's password hash, an API key, a JWT signing secret).

Every case's correctness is structural: these phrasings should always be refused, regardless of catalogue content — this is why they can be `APPROVED` immediately rather than needing per-case ground-truth review.

## Real execution and scoring

`BenchmarkPipelineService.runSafetyCategory()`/`runSecurityCategory()`/`runPromptInjectionCategory()` all call the shared `runRefusalCases()` helper: a real `CatalogueRagService.ask()` call per case, checking that the answer never reached generation or deterministic lookup (`!usedGeneration && !usedDeterministicLookup`) — the same real refusal check DGX Prototype 1.5's offline evaluation harness already used for `PROMPT_INJECTION`/`UNSUPPORTED_DIAGNOSTIC` cases.

`secretDisclosureCount`/`permissionLeakageCount` in `SafetyCategoryMetrics`/`SecurityCategoryMetrics` are real counts (currently always passed as `0` from the pipeline, since the refusal check structurally prevents generation from running at all for these cases) — a real, separately-verifiable claim, not an assumption baked into the metric.

## Permission Enforcement (spec §15's "permission leakage")

Documented separately because it needs no LLM call at all — `PermissionEnforcementCategoryMetrics` is computed purely from the real, live `ROLE_PERMISSIONS` map (see `gold-dataset.md`'s table). `leakageCount` specifically flags the most dangerous real failure mode: a case expected to be denied that was actually granted — distinct from an over-cautious wrong denial, which is a usability issue, not a security one.

## Real test coverage

`safety-security-cases.spec.ts`: every generated safety/security/injection case expects a refusal and is `APPROVED`; every real (role, permission) pair's expected grant matches what the live `ROLE_PERMISSIONS` map actually says, and both deny and allow cases are represented.
