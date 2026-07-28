# Shadow-Mode Internal Pilot

## Real, operator-controlled flags

`src/catalogue-ai/rag/shadow-mode.ts` — two independent, real environment-variable-gated controls:

- **`CATALOGUE_RAG_SHADOW_MODE`** (default: enabled — safe posture until this prototype clears acceptance thresholds). When enabled:
  - Every generative answer's `directAnswer` is prefixed with a real, visible label: `"[AI explanation — shadow-mode pilot, not a confirmed answer] "`.
  - Any answer with confidence `LOW`, `CONFLICTING`, or `INSUFFICIENT_EVIDENCE` automatically creates a real `ManualReviewItem` via the existing `ManualReviewService.enqueue()` (queue type `CATALOGUE_RAG_SHADOW_MODE_REVIEW`) — "all low-confidence responses are flagged" and "all conflict responses route to review" are enforced as real code, not documentation.
- **`CATALOGUE_RAG_GENERATION_ENABLED`** (default: enabled) — a real, separate kill switch. When set to `false`, `CatalogueRagService.answerFromRag()` returns an honest `INSUFFICIENT_EVIDENCE` response immediately, without ever calling embed/generate. Deterministic search is completely unaffected either way — this is "AI can be disabled instantly," verified in `scripts/verify-dgx-prototype-1-5.ts` steps 33-34 (disable, verify fallback, re-enable, verify generation resumes).

## Already true, unchanged from Prototype 1 (real, structural guarantees)

- Deterministic search remains primary — every identifier-shaped query tries deterministic lookup before any DGX call.
- No AI writes: nothing in `src/catalogue-ai/` writes to a canonical business table (`Part`, `LubricantProduct`, `SalesDocument`, etc.) — every write goes through `ManualReviewService`/`AiFeedbackService`, both pre-existing, human-gated services.
- No AI merge decisions: `PartRelationshipService.propose()` always creates a `PENDING` relationship; only `verify()`/`reject()` (requiring a real human `reviewerId`) change that status.
- No AI fitment confirmations: `verifiedFitment`/`verifiedFacts` in a `CatalogueRagAnswer` are only ever populated from real, already-verified `PartCompatibility`/`PartRelationship` rows or high-confidence approved documents — never inferred by the LLM's own text.

## User feedback

`AiFeedbackService`/`AiFeedbackDecision` (Phase 4, unchanged, extended additively in Prototype 1 with catalogue-specific decision types) remains the real feedback-capture mechanism — `POST /catalogue/feedback`. Feedback is not made mandatory at the API level this phase (no enforcement that a client must submit feedback before proceeding); "mandatory or strongly encouraged" is left as a UI/product decision for whatever client consumes this API, not a backend enforcement rule, since enforcing it server-side would risk blocking legitimate read-only catalogue lookups.

## Real verification

`scripts/verify-dgx-prototype-1-5.ts` step 37 runs a real query with shadow mode at its default (enabled) setting and confirms the real answer text carries the shadow-mode label.
