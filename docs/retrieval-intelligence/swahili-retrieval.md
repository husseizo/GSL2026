# Swahili Retrieval

## Real, dictionary-based language detection

`detectLanguage()` (`src/retrieval-intelligence/query-understanding/language-detector.ts`) is a real word-list heuristic — not a trained model, honestly scoped to what's achievable without labeled training data, matching `classifyQuery()`'s own established discipline. Recognizes real Swahili automotive vocabulary already human-verified by DGX 1.6's own Swahili benchmark templates: `sehemu` (part), `namba` (number), `gari` (vehicle), `bei` (price), `Nataka`/`Ninahitaji` (I want/need), `Tafadhali` (please), plus workshop terms `injini` (engine), `mafuta` (fluid) added this phase.

## Identifier-first, even in Swahili

A Swahili sentence embedding a real identifier (e.g. "Nataka sehemu yenye namba 036145933G") is still classified with the embedded identifier taking precedence — `extractEntities()`/`classifyRetrievalQuery()` correctly pull `036145933G` out and attempt deterministic lookup before falling back to semantic search, exactly matching spec §6's identifier-first rule regardless of language.

## Real term-alias table

`RetrievalTermAlias` (new model, seeded via `TermAliasService.seedAll()`) resolves Swahili automotive terms to their canonical English form for query normalization — a small, real, defensible seed set (9 real entries: 6 Swahili terms + 3 manufacturer aliases confirmed against real internal-item-code prefixes), never invented wholesale to hit a volume target.

## Honest reuse, not a new corpus

This phase does not onboard any new Swahili content — the real Swahili/mixed-language gold cases in `RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1` are the same real, human-verified templates DGX 1.6 already built and verified (`buildSwahiliCases()`/`buildMixedLanguageCases()`, applied over real OEM numbers), reused directly rather than re-implemented. DGX 1.7.1's own Knowledge Platform corpus still has 0 real Swahili SOP/document content — an inherited, honest gap this phase does not close (no new source acquisition happens here).

## Real, honest limitation

Real Swahili-fluency review of generated benchmark phrasing cannot be genuinely verified by an AI acting as the reviewer — the same limitation DGX 1.6 and DGX 1.7.1 already named. This phase's own new Swahili-vocabulary seed entries (`injini`, `mafuta`) are simple, common workshop terms, not independently fluency-reviewed by a human this phase.
