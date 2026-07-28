# Catalogue AI Pilot Integration

## Scope

Per spec, Catalogue AI is the only consumer activated this phase — additive integration only, never removing or weakening the existing deterministic search path. Every Catalogue AI response drawing on Knowledge Platform content must include snapshot ID, item IDs, claim IDs, exact citations, authority, verification status, freshness, conflict status, and confidence. If approved evidence is absent, the correct response is no answer / insufficient evidence, never an unsupported claim.

## Real verification performed

Steps 52–56 of the verify script call `enrichContext()` (the existing Catalogue AI integration point) for: an exact part identifier (0 candidates for a non-existent part — correctly zero, not a fabricated match), a lubricant approval lookup, and other real query shapes against the real corpus.

## Real limitation found

Because the trusted-knowledge snapshot never reached `ACTIVE` status (blocked by real gate failures — see [knowledge-snapshot.md](knowledge-snapshot.md)), Catalogue AI pilot integration this phase was verified against the **approved-but-not-activated** snapshot content directly (via `searchKnowledge()`/`enrichContext()`), not against a live-activated snapshot in the production retrieval path. This is an honest scope limitation of `NEEDS_MORE_TUNING`, not a claim that Catalogue AI is live-consuming trusted knowledge in production today.

## No answer / insufficient evidence discipline

The retrieval layer's existing, unmodified contract (`KnowledgeRetrievalService.searchKnowledge()`) already returns empty/no-match results rather than fabricated answers when no approved evidence exists — confirmed directly via the zero-candidate real query in step 52.
