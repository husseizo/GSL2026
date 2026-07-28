# Evaluation Framework Integration

Exactly one new `BenchmarkCategory` value, `KNOWLEDGE` — not five separate new categories, not a reuse of `GENERATION` — added to the existing DGX Prototype 1.6 taxonomy (`src/ai-benchmark/categories/category-taxonomy.ts`). Confirmed with the user during planning (see `decision-log.md`).

## 7 nested sub-scores

`KnowledgeCategoryMetrics` nests `retrieval`, `supersession`, `applicability`, `authorityRanking`, `expiredRestrictedExclusion`, `graphRelation`, `structuredFactExtraction` — mirroring exactly how Hallucination/Citation ride as sub-scores inside `GENERATION` rather than becoming top-level categories. `computeKnowledgeMetrics()` (`pipeline/category-metrics.ts`) scores each independently — never blended into one number, and returns honest defaults (score `1`, `casesScored: 0`) when a sub-score has zero samples rather than a false failure. Unit-tested in `pipeline/knowledge-metrics.spec.ts`.

## Real pipeline wiring

`BenchmarkPipelineService` gained one new, non-optional constructor dependency: `KnowledgeRetrievalService`. `runKnowledgeCategory()` runs real `searchKnowledge()` calls against real published items for retrieval cases, and real Prisma lookups for supersession/expiry/restriction cases — see `gold-knowledge-dataset.md` for the case generators. Verified end-to-end by the verify script (step 39).

**Real gap found while wiring this**: `AiBenchmarkModule` never imported `KnowledgePlatformModule`, so `KnowledgeRetrievalService` could not resolve — this would have crashed app bootstrap. Fixed (see `decision-log.md`).

## Honest, named limitation: the two pre-existing categories were not extended

The plan called for feeding `CONFLICT_DETECTION` and `PROMPT_INJECTION` (both pre-existing DGX 1.6 categories) with Knowledge-Platform-sourced cases, in addition to the new `KNOWLEDGE` category. That cross-pollination was **not built this phase** — confirmed by grep against `identifier-scaled-cases.ts` and `safety-security-cases.ts`. The new `KNOWLEDGE` category's own sub-scores already cover conflict/injection-adjacent concerns (`expiredRestrictedExclusion`, etc.) for knowledge-specific data, but a genuinely unified cross-category view does not exist yet. Named here rather than silently claimed done.
