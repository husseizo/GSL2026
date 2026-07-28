# Knowledge Review Workflow

The review *workflow* itself reuses `KnowledgeItemVersion.status`'s own state machine directly (`DRAFT → IN_REVIEW → APPROVED/REJECTED`) rather than a separate generic queue table. `KnowledgeReviewAssignment` is the one genuinely new concept: routing a specific version to a specific reviewer role and recording that reviewer's real decision. See `KnowledgeReviewService` (`src/knowledge-platform/review-workflow/`).

## Reviewer roles and decisions

`KnowledgeReviewerRole`: `TECHNICAL_REVIEWER | LICENSING_REVIEWER | SAFETY_REVIEWER | FINAL_APPROVER`.
`KnowledgeReviewDecision`: `APPROVE | REJECT | REQUEST_CHANGES`.

## Multi-reviewer gate

`assignReviewer()` moves a `DRAFT` version to `IN_REVIEW`. `decide()`:

- `REJECT` immediately transitions the version to `REJECTED` — verified end-to-end by the verify script (step 26).
- `REQUEST_CHANGES` leaves the version `IN_REVIEW` — a real reviewer asked for changes, not a rejection.
- `APPROVE` only transitions the version to `APPROVED` once **every** assigned reviewer for that version has independently decided `APPROVE` — a single reviewer's approval never silently finalizes a multi-reviewer item. Verified by the verify script (step 27).

## The real review queue

`reviewQueue()` returns every undecided assignment, ordered by assignment time — the real API/CLI-queryable equivalent of the spec's "review queue" screen concept, since the UI itself is deferred this phase (`portal-ui-deferred.md`).
