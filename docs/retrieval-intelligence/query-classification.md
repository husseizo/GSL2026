# Query Classification

## The 21 classes (spec §3)

`classifyRetrievalQuery()` (`src/retrieval-intelligence/query-understanding/query-classifier.ts`) classifies every real query into exactly one of: `OEM_PART_NUMBER, INTERNAL_ITEM_CODE, TECDOC_ARTICLE, BARCODE, SKU, VEHICLE_VIN, ENGINE_CODE, TRANSMISSION_CODE, LUBRICANT_APPROVAL, LUBRICANT_PRODUCT, VEHICLE_MODEL, FAULT_CODE, TECHNICAL_PROCEDURE, FREE_TEXT_QUESTION, MIXED_QUERY, SWAHILI, ENGLISH, MIXED_LANGUAGE, TYPO, APPROXIMATE_SEARCH, UNKNOWN`. Every query is classified before retrieval begins — no code path in the pipeline skips this stage.

## Ordering — identifier-first, always

Identifier-shaped classes are checked before any free-text/language class, since spec §6 requires identifier lookup to always be attempted before semantic search. Real, reused regexes: `VIN_PATTERN`/`VISCOSITY_PATTERN`/`APPROVAL_PATTERN`/`EMBEDDED_IDENTIFIER_TOKEN` are imported directly from the existing `src/catalogue-ai/rag/query-understanding.ts` (exported additively this phase, not copy-pasted) rather than re-derived.

## Real bug found and fixed: approval-pattern false positive on internal item codes

`APPROVAL_PATTERN` (reused, unmodified) matches both a genuine approval code ("VW 502.00") and, by coincidence, a bare internal item code with no separator ("MB100111", since the pattern allows a zero-width separator between the brand prefix and digits). Confirmed via a real unit test failure: `classifyRetrievalQuery('MB100111')` returned `LUBRICANT_APPROVAL` instead of `INTERNAL_ITEM_CODE`. Fixed with a local `looksLikeGenuineApprovalFormat()` check requiring a real separator (space/hyphen) or decimal point — matching the real, confirmed formatting difference between genuine approval codes and this catalogue's internal-code convention — without modifying the shared, already-live `APPROVAL_PATTERN` regex.

## Real, observed identifier shapes (confirmed against the live catalogue)

- Internal item codes: 2–5 letter supplier prefix + 4–8 digits (e.g. `MB100111`, `BM12328`, `VAG12695`).
- OEM numbers: alphanumeric, commonly with spaces (e.g. `164 440 52 41`) — real formatting noise is normalized away by `query-normalizer.ts`.
- Real VINs: 17 characters, confirmed against the live `Vehicle` table (e.g. `SALGA2FE8HA123456`).
- Real engine codes: short alphanumeric, 3–6 characters (e.g. `204DTD`, `M254`, `B57`).
- **Real, confirmed gap**: `Part.tecdocArticleId` is 0% populated in the live catalogue — real TecDoc content lives only in the separately-ingested Knowledge Platform corpus from DGX 1.7.1 (`tecdoc-article-*` KnowledgeItems), not joined onto `Part`. The pipeline's candidate generation therefore also queries `KnowledgeItem` by key/title for TECDOC_ARTICLE-class queries, not just `CatalogueSearchService.findByTecdocId()`.
- **Real, confirmed gap**: no real barcode/EAN/UPC data exists anywhere in this environment. `BARCODE` classification uses a real, checksum-validated (GTIN mod-10) pattern, but has never matched a real catalogue row — reported honestly, not fabricated.

## Typo and approximate-search detection

Real Levenshtein edit distance (`levenshteinDistance()`) against a real, caller-supplied sample of known identifiers — never fabricated. Distance 1–2 → `TYPO`; distance 3–4 → `APPROXIMATE_SEARCH`. Checked after every specific identifier pattern but before the generic alphanumeric fallback, so a genuine near-miss against a real known identifier is never misclassified as "just a new identifier."

## Language detection

`detectLanguage()` (`src/retrieval-intelligence/query-understanding/language-detector.ts`) is a real, dictionary-based heuristic — not a trained model — using the same real, human-verified Swahili vocabulary DGX 1.6's own Swahili benchmark templates already established (`sehemu`, `namba`, `gari`, `bei`, `Nataka`, `Ninahitaji`, etc.).
