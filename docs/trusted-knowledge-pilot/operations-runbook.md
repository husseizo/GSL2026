# Operations Runbook — Trusted Knowledge Pilot

## Real one-shot scripts (in execution order)

1. `scripts/run-real-structured-ingestion.ts` — seeds 11 extraction profiles, ingests 8 self-authored SOPs, real Liqui Moly rows, real TecDoc articles, real repair cases, and the bounded real fitment-edge sample.
2. `scripts/run-real-review-and-publish-sample.ts` — reviews, approves, and publishes a bounded real sample (all SOPs, all repair cases, 50 Liqui Moly items, 50 TecDoc articles = 115 total).
3. `scripts/backfill-real-embeddings.ts` — paced (2100ms/call, matching `CatalogueIndexVersionService.paceEmbedCall()`) backfill of missing real embeddings for materialized `KnowledgeDocument` rows; idempotent, safe to re-run.
4. `scripts/run-real-snapshot-and-gates.ts` — builds the real pilot snapshot, builds/reuses the frozen `TRUSTED_KNOWLEDGE_GOLD_EVAL_V1` benchmark, runs the real KNOWLEDGE category benchmark, evaluates real trusted-knowledge gates, attempts gated activation.
5. `scripts/verify-trusted-knowledge-onboarding.ts` — the 70-step, real, end-to-end verification script. Run via `npx ts-node -T scripts/verify-trusted-knowledge-onboarding.ts`.

## Re-running the pipeline

Steps 1–2 are safe to re-run for new source data (checksum-based dedup in the existing `ingest()` prevents duplicate items). Step 3 is idempotent (only embeds chunks with no existing row). Step 4 is idempotent for the gold benchmark (reuses the frozen dataset if found) but creates a new `KnowledgeSnapshot` version each run — old snapshots remain in the retained history for rollback.

## Known operational gotchas found this pilot

- **Never leave scratch/debug `.ts` files in `scripts/`** — `npm run build` (`nest build`) compiles every `.ts` file under the project, including one-off scratch scripts. A stray file with a type error (e.g. an incorrect Prisma field name) fails the real build and is picked up as a real step-5 failure by the verify script. Scratch scripts must be deleted immediately after use.
- **Never call `publish()`/any embedding-triggering method in a tight loop** — real DGX embedding calls are rate-limited (~30 req/60s via `paceEmbedCall()`'s 2100ms pacing). An unpaced loop produces silent (warning-level, not thrown) embedding failures that only surface later as unexplained retrieval-quality regressions.

## See also

[final-report.md](final-report.md) for the full real verdict and remaining limitations.
