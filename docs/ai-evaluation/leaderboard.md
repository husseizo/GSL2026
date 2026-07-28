# AI Leaderboard — DGX Prototype 1.6 (spec §17)

## One ranked list per category — never blended

`LeaderboardService.getCategoryLeaderboard(category)` returns a single ranked list for exactly one `BenchmarkCategory`, ordered by that category's own real primary metric (`PRIMARY_METRIC_PATH` in `src/ai-benchmark/leaderboard/leaderboard.service.ts` — e.g. `recallAt1` for `RETRIEVAL`, `avgGroundedness` for `GENERATION`, `p95Ms` for `PERFORMANCE`, correctly ordered `LOWER_IS_BETTER`). `getFullLeaderboard()` returns an array of 16 independent `CategoryLeaderboard` objects — structurally, there is no code path that could merge them into one combined rank, since each is computed from a separate query filtered to one category.

## Real data source

Every entry is queried live from real, persisted `BenchmarkRun` rows (`status: 'COMPLETED'`), joined to the real `AiModel` name, `promptVersionId`, and `rerankerName` that produced it — nothing here is simulated or precomputed outside the database.

## Real test coverage

`ai-benchmark.integration-spec.ts`'s leaderboard test confirms a real category leaderboard query returns the correct `metricPath` and a real array shape against actual Postgres rows. `scripts/verify-ai-evaluation-framework.ts` step 38 asserts all 16 categories return an independent leaderboard object.

## Where it's surfaced

`GET /ai/leaderboard` (full) and `GET /ai/leaderboard/:category` (single category) — both gated by `ai.evaluations.read`. The same data also feeds the "AI Quality"/"Benchmark Trends" sections of the static HTML dashboard — see `leaderboard.md`'s sibling doc, `production-readiness.md`, and the dashboard itself at `docs/ai-evaluation/reports/latest.html`.
