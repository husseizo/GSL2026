# Decision Log — DGX Prototype 1.7.1

## Scope decisions

1. **Reuse via composition, not reconstruction.** `MolasLubricantsCacheAdapter` and `PartsCatalogAutoHubAdapter` (built in the earlier Data Consolidation phase) are reused unmodified, driven by new config objects — zero new database connectivity code was written. Confirmed both are live and reachable this session before committing to this approach.
2. **Company-owned data classification** (real `AskUserQuestion` decision) — see [licensing-decisions.md](licensing-decisions.md) Decision 1.
3. **Liqui Moly structured-fields-only narrowing** (self-imposed) — see [licensing-decisions.md](licensing-decisions.md) Decision 2.
4. **`tecdoc_article_vehicle` bounded to a 50,000-edge deterministic sample** out of 3,378,514 real rows — see [licensing-decisions.md](licensing-decisions.md) Decision 5.
5. **`ReviewBatch` renamed to `KnowledgeReviewBatch`** after discovering a real model-name collision with an unrelated Data-Readiness-phase model.
6. **New KNOWLEDGE-specific quality gates built as a separate evaluator** (`trusted-knowledge-quality-gates.ts`), not merged into DGX 1.6's `quality-gates.ts` — keeping the generic evaluator's behavior byte-for-byte unchanged for all other benchmark categories.
7. **`KnowledgeSourcePermission`'s 13-action matrix and the existing legacy boolean fields are both checked (AND logic) at every real call site** — named as a real two-surface risk in [source-permission-matrix.md](source-permission-matrix.md), never resolved by relying on only one.

## Real bugs found and fixed (see individual docs for detail)

| Bug | Doc |
|---|---|
| Hand-rolled test PDF fragile at certain lengths | [pdf-ingestion.md](pdf-ingestion.md) |
| Jest + pdfjs-dist ESM incompatibility | [pdf-ingestion.md](pdf-ingestion.md) |
| OCR presence threshold falsely triggered on short real text | [ocr-policy.md](ocr-policy.md) |
| `approval_statement` claim pattern missed "recommended" statements | [entity-normalization.md](entity-normalization.md) |
| Rate-limit tight loop silently broke most real embeddings | [evaluation-results.md](evaluation-results.md) |
| `doc.content` field-name error in the embedding backfill script | [operations-runbook.md](operations-runbook.md) |
| Gold benchmark idempotency (`findFirst` vs `findUnique` on a compound key) | [evaluation-dataset.md](evaluation-dataset.md) |
| Step-26 OCR crash on an empty test buffer | [ocr-policy.md](ocr-policy.md) |
| Step-26 assertion too strict for real OCR digit truncation | [ocr-policy.md](ocr-policy.md) |
| Stray scratch `.ts` files in `scripts/` broke the real build | [operations-runbook.md](operations-runbook.md) |

## Real, substantive (non-bug) finding

Exact-identifier retrieval rank varies by content distinctiveness (SOPs rank 0, generic TecDoc titles rank ~4) — a genuine retrieval-quality characteristic, not a defect. See [quality-gates.md](quality-gates.md) and [evaluation-results.md](evaluation-results.md). Not fixed this phase (would require redesigning retrieval ranking, out of scope).

## Honest gaps carried into the final report

No real Category B/C/D source onboarded; only 114 of 500 target gold eval cases built; only 4 of 50+ target conflict cases exist; 0 of 100+ target Swahili/mixed-language cases exist; only 7 real repair cases exist. All reported plainly in their respective docs and in [final-report.md](final-report.md) — none fabricated to hit a numeric target.
