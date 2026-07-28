# Gold Knowledge Dataset

Reuses `BenchmarkRegistryService.freezeAsGold()` **unmodified** — no new gold-freeze mechanism was built. The same append-only-version + gold-freeze-with-checksum pattern DGX Prototype 1.6 already proved (frozen benchmarks reject `addCases()`, checksum-verifiable) applies directly to a `KNOWLEDGE`-category benchmark.

## Real case generators (`src/ai-benchmark/categories/knowledge-cases.ts`)

- `buildKnowledgeRetrievalCases(prisma, cap)` — one case per real, currently-`PUBLISHED` `KnowledgeItemVersion`, expecting `searchKnowledge()` to retrieve its item by title.
- `buildSupersessionCases(prisma, cap)` — one case per real `SUPERSEDED` version with a real `supersededBy` chain, expecting current retrieval to resolve to the newer version.
- `buildExpiredRestrictedCases(prisma, cap)` — one case per real `EXPIRED` version and one per real `RESTRICTED`-classified source, expecting each to be excluded.

All three are mechanically scaled from whatever the platform has actually published, ingested, or expired in this environment — never fabricated. In an environment with few real published items, the resulting case count is honestly small, not padded to a round number (see `real-content-and-limitations.md`).

## Freeze and immutability

`register a KNOWLEDGE benchmark → addCases() → approve() → freezeAsGold() → verifyChecksum()`. Verified by the verify script (step 40): a post-freeze `addCases()` call is rejected, and the recomputed checksum matches the stored one.
