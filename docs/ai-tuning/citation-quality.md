# Citation Quality

## Runtime validation vs. offline evaluation

`src/catalogue-ai/rag/citation-validator.ts`'s `validateCitations(citedDocumentIds, retrievedDocumentIds)` is a **runtime** check — run once per real answer, inside `CatalogueRagService.answerFromRag()`, immediately after parsing the model's structured JSON output. This is distinct from (but logically consistent with) `generation-metrics.ts`'s aggregate offline-evaluation `citationCorrectness()` used by `CatalogueEvaluationService`.

`validateCitations()` returns:
- `correct` — true only if every model-cited document id was actually in the real retrieved-and-included set.
- `missingSourceIds` — cited ids that were **not** retrieved (a fabricated citation) — real evidence this can happen: the model is asked to return `citedDocumentIds` as part of its JSON output, and nothing prevents it from hallucinating an id.
- `extraRetrievedNotCited` — real retrieved sources the model didn't bother citing — informational, doesn't affect correctness.

When `citationCheck.correct` is false, `CatalogueRagService` adds a real, visible warning to `conflictsOrWarnings` ("The model cited N source(s) that were not actually retrieved — those citations were discarded") rather than silently keeping the fabricated citation in the response.

## Known, documented limitation

Citation correctness as measured by the offline evaluation harness (`avgCitationCorrectness: 1.0` in every run so far) validates a **structural guarantee** — `ragAnswer.sources` is always exactly the real retrieved-and-included document set, so comparing it against itself is trivially 1.0 — not that the model's free-text answer explicitly referenced each cited source by name in-line. Real in-line citation-marker parsing (checking that the generated prose actually says something like "[1]" or names the source) is not implemented this phase. This is documented rather than presented as a stronger guarantee than what exists — see the equivalent note carried over from Prototype 1's [source-citations.md](../ai/source-citations.md).

## What changed this phase

The model is now asked for a much narrower `citedDocumentIds: string[]` field (as part of the structured JSON schema) instead of being expected to weave citations into free text — this makes the *validation* step (comparing an array of ids) meaningful and cheap, versus Prototype 1's approach of comparing `ragAnswer.sources` against itself (trivial by construction, since there was no separate "what did the model claim to cite" signal at all). Whether the model's `citedDocumentIds` output is itself reliable (vs. defaulting to citing everything, or citing nothing) was not separately measured this phase — a real gap for a future evaluation pass.
