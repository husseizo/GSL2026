# Multilingual Catalogue Assistant

## Scope: English, Tanzanian Swahili, mixed

The spec requires supporting English, Swahili, and mixed-language queries without ever translating OEM numbers, product codes, engine/transmission codes, or API/ACEA/manufacturer approval classifications.

## How identifier preservation actually works

`query-understanding.ts`'s `classifyQuery()` is a regex-based heuristic that operates on the raw query string regardless of language — it does not perform language detection or translation at any point. A short alphanumeric token with a digit is classified `IDENTIFIER` and routed straight to deterministic lookup, in any language the surrounding text might be in. A longer natural-language sentence (Swahili, English, or mixed) that merely *contains* a real identifier is classified `DESCRIPTION` and falls through to the generative path — where the identifier survives because the retrieval and prompt-assembly steps never translate or rewrite the query text; they embed it and pass it through as-is.

## Real test performed

`scripts/verify-dgx-catalogue-rag.ts` step 28 ran a real query: `"Nataka sehemu yenye namba <real OEM number>"` ("I want the part with number `<OEM>`" in Swahili). The real generated response was checked for the literal, unmangled OEM number appearing either in the direct answer text or among the matched products' exact identifiers — it did. This is one real, passing spot-check, not a systematic multilingual benchmark.

`query-understanding.spec.ts` covers the classification boundary directly: a Swahili sentence containing a real OEM number classifies as `DESCRIPTION` (five words, correctly exceeds the identifier heuristic's word-count limit) while the bare OEM number alone classifies as `IDENTIFIER` — proving both routes preserve the identifier, just via different paths (deterministic lookup vs. pass-through into the generative prompt).

## What is not yet built

- No language auto-detection or language-tagging is recorded on `KnowledgeDocument`/`AiInferenceLog` for catalogue queries specifically (the `KnowledgeDocument.language` field exists from Phase 4 but defaults to `'en'` for catalogue documents built by `CatalogueIndexVersionService`, since the real underlying catalogue text is in English).
- No systematic evaluation set of Swahili queries exists (see [offline-evaluation.md](offline-evaluation.md)) — only the one real spot-check above.
- No explicit translation-refusal test exists proving the LLM never translates an OEM number when asked to (e.g., "translate this part number to Swahili") — a real gap worth closing before a broader pilot, not claimed as tested.
