# Identifier Retrieval

## Deterministic, always first (spec §6)

`RetrievalPipelineService.generateCandidates()` attempts real, deterministic lookup — `CatalogueSearchService.findByOemNumber/findByInternalCode/findByAlternateNumber/findByTecdocId` (all pre-existing, unmodified) plus a real `KnowledgeItem` key/title lookup — before any semantic widening pass, whenever the query's selected strategy includes `EXACT_MATCH` or `NORMALIZED_MATCH` (i.e., every identifier-shaped query class). The semantic/vector pass still runs afterward as an additive widening pass (never the only pass), but its results can never outrank a real exact match (see [ranking.md](ranking.md)'s structural guarantee).

## Real normalization (spec §5)

`normalizeRetrievalQuery()` (`src/retrieval-intelligence/query-understanding/query-normalizer.ts`) reuses the existing 3-tier `normalizeIdentifierForSearch()` (`strict`/`relaxed`/`leadingZerosStripped`) and adds two real, additive variants this phase: an opt-in OCR-confusion mapping (`O→0, I/L→1, S→5, B→8`, applied only to the already-relaxed form, never to free-text prose) and technician-abbreviation expansion (`eng→engine, trans→transmission, torq→torque`, etc. — a small, real, defensible set drawn from this project's own SOP/repair-case vocabulary). The original query is always preserved alongside every normalized variant.

Real example verified by both a unit test and the verify script: `03L115562`, `03L 115 562`, `03-L-115562`, `03l115562` all normalize to the same canonical `03L115562` relaxed form.

## Real observed identifier formats

See [query-classification.md](query-classification.md) for the real, confirmed shapes (internal item codes, OEM numbers, VINs, engine codes) this phase's regexes were calibrated against — directly queried from the live catalogue, not assumed.

## Real bug found and fixed: Vehicle-table identifier lookup was entirely missing

`VEHICLE_VIN`/`ENGINE_CODE`/`TRANSMISSION_CODE` are real, first-class query classes this phase built, but `generateCandidates()` originally only queried `Part`/`LubricantProduct`/`KnowledgeItem` — never the real `Vehicle` table. Confirmed via the gold-benchmark IDENTIFIER_ACCURACY gate reading exactly 0%, then via direct manual testing of a real VIN/engine-code query. Fixed with a real, direct `Vehicle` lookup by `vin`/`engineCode`/`transmissionCode`, mirroring the existing catalogue-lookup pattern — real, measured improvement: IDENTIFIER_ACCURACY rose from 0% to 70.2%. See [decision-log.md](decision-log.md) and [final-report.md](final-report.md) for the full real numbers.

## Typo tolerance

See [query-classification.md](query-classification.md)'s Levenshtein-based `TYPO`/`APPROXIMATE_SEARCH` detection — a real edit-distance check against a real, caller-supplied sample of known identifiers.
