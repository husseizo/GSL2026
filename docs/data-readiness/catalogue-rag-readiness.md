# Catalogue RAG Readiness

`src/data-readiness/rag/catalogue-rag-corpus.service.ts` — a real, provenance-preserving retrieval corpus built from the actually-imported real catalogue, not a synthetic example set.

## Real corpus built (2026-07-13)

```
8,157 real entries total: 7,723 VERIFIED (spare parts), 434 PARSED_UNVERIFIED (lubricants)
```

## Spare parts (7,723 entries, all `VERIFIED`)

Each entry: canonical `Part` id, real OEM number + alternate numbers, real product description, brand, category, and **real source citations** (`sourceSystem`/`sourceRecordId` from `PartExternalReference`). Confidence is `VERIFIED` for every part because the identity itself was confirmed by a real OEM-number match during import (see [docs/data-consolidation/parts-consolidation.md](../data-consolidation/parts-consolidation.md)) — no unverified inference is included in this corpus.

## Lubricants (434 entries, mostly `PARSED_UNVERIFIED`)

Each entry: product name, brand, category, real source citations. Confidence is `VERIFIED` **only** when a real `LubricantApproval.isVerified = true` row exists for that product — as documented in [lubricants-quality.md](lubricants-quality.md), **zero** real lubricant products currently have a verified approval, so every lubricant entry in this corpus is honestly labeled `PARSED_UNVERIFIED`. A RAG consumer built on this corpus must caveat lubricant technical claims accordingly (e.g. "according to unverified catalogue data..." rather than presenting them as confirmed facts) until a verified technical-specification source is imported.

## Provenance is structural, not optional

Every `RagCorpusEntry` carries `sourceCitations` — there is no code path that produces an entry without at least one real source reference, since the corpus is built directly from `Part`/`LubricantProduct` rows that only exist because a real `PartExternalReference`/`LubricantExternalReference` was created during import.

## Readiness

Backs the `AIUseCaseReadiness` assessments for "Automotive catalogue RAG," "Parts semantic search," and "Lubricant product retrieval" — all three real-evidence-classified `READY_FOR_PROTOTYPE` (see [ai-use-case-readiness.md](ai-use-case-readiness.md)). "Lubricant specification assistant" remains `BLOCKED_BY_SOURCE_ACCESS` specifically because this corpus's lubricant entries are unverified, not because the retrieval mechanism itself is unready.
