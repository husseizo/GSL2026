# Manual Review Handoff

## No new review model

This phase reuses the Data Consolidation phase's `ManualReviewService.enqueue()` and `ManualReviewItem` model directly, rather than building a parallel catalogue-specific review queue. `queueType` is a free-text field, so catalogue-originated reviews are tagged (e.g. `CATALOGUE_RAG_REVIEW`) without a schema change.

`POST /catalogue/review-handoff` (permission: `reviewQueue.assign`) accepts `{ queueType, proposedAction, evidence, confidence? }` and calls `manualReview.enqueue()` directly — no catalogue-specific business logic sits between the controller and the existing service.

## What can trigger a handoff

- A real category-level conflict flagged by `CatalogueSearchService.hasRealConflict()` (a genuine identity error, distinct from the expected brand-only differences — see [catalogue-corpus-contract.md](catalogue-corpus-contract.md)).
- A `PENDING` `PartRelationship` proposed by `PartRelationshipService.propose()` — every proposed relationship starts `PENDING` and is surfaced for review before it can ever be treated as fact.
- A `MANUAL_REVIEW_REQUIRED` corpus-eligibility classification (a brand-only conflict indexed with a visible warning rather than excluded).
- Low-confidence or `INSUFFICIENT_EVIDENCE` RAG answers, where `recommendedNextAction` explicitly suggests routing to a human.

## The assistant never finalizes a review decision

Every write path that could resolve a review — `PartRelationshipService.verify()`/`reject()`, and the underlying `ManualReviewService`'s own decision-recording methods (unchanged from the Data Consolidation phase) — requires a real `reviewerId`. There is no code path anywhere in `src/catalogue-ai/` that sets a `PartRelationship.verificationStatus` to `APPROVED` or resolves a `ManualReviewItem` without a human-supplied reviewer id. `scripts/verify-dgx-catalogue-rag.ts` step 25 demonstrates this: it creates a real `ManualReviewItem` via the handoff path and stops there — no automated approval follows.

## Real verification

Step 25 of the verification script created a real `ManualReviewItem` (id logged in the run output) with `queueType: 'CATALOGUE_RAG_REVIEW'`, real evidence referencing the query that triggered it, and `confidence: 0.5` — confirming the endpoint, the service call, and the underlying `ManualReviewItem` row all work end-to-end against the real database.
