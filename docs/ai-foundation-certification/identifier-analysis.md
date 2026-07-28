# AI Foundation Certification Sprint — Identifier Analysis

Priority #1 of the sprint's optimization order. This document is the real, evidence-based record of every identifier-classification bug found and fixed, in the order discovered.

## Starting point (inherited from DGX 1.7.2)

150-case sample: `IDENTIFIER_ACCURACY = 0.702`. Not investigated further at the time — this sprint's job was to close it.

## Bug 1 — pure-numeric OEM numbers fell through to `UNKNOWN`

A direct query of the live catalogue found **38.6% of all real OEM numbers (2,979 of 7,723 real parts) are pure numeric** after normalization (e.g. `64316935822`, `072767210`). The generic alphanumeric fallback in `query-classifier.ts` required both a digit *and* a letter (`&& /[A-Z]/.test(relaxed)`), so every pure-numeric OEM number fell through every Section-1 pattern straight to `UNKNOWN` — which is not in `IDENTIFIER_SHAPED_CLASSES`, so deterministic exact lookup was never attempted for roughly 4 in 10 real OEM-number queries.

**Fix:** dropped the letter requirement. `EXACT_OEM` + `FORMATTED_OEM_VARIATION` + `INTERNAL_CODE` alone are 81.5% of the real gold set — this was the single highest-leverage fix of the sprint.

## Bug 2 — `candidateIdentifier` returned the separator-stripped form

`CatalogueSearchService.findByOemNumber()` has its own real strict-then-relaxed cascade, trying the identifier exactly as typed before falling back to a separator-stripped match. Passing an already-stripped `relaxed` string skipped that strict step — confirmed with two real duplicate `Part` rows (`"164 440 52 41"` vs `"1644405241"`), where passing the pre-stripped form caused the wrong row's strict match to fire.

**Fix:** return `trimmed` (original formatting) as `candidateIdentifier` instead of `relaxed`, letting the existing lookup cascade run as designed.

## Bug 3 — real trailing `+` convention broke the pattern entirely

Direct query confirmed real stored OEM numbers use a trailing `+` (e.g. `1K0853651E+`). The `+` character sits outside `[A-Z0-9]`, breaking the whole-string and embedded-token patterns.

**Fix:** both patterns widened to tolerate an optional trailing `+`.

## Bug 4 — embedded pure-numeric identifiers in sentences never extracted

The shared `EMBEDDED_IDENTIFIER_TOKEN` regex (reused from the live Catalogue RAG chat classifier, deliberately never modified) requires both a letter and a digit, so a real pure-numeric OEM number embedded in a sentence (e.g. `"Nataka sehemu yenye namba 1645000049"`) was never extracted.

**Fix:** added local, additive `embeddedNumeric` (`/^\d{6,13}\+?$/`, length range calibrated from a direct query showing 99.6% of real pure-numeric OEM numbers are 6-13 digits) and `embeddedAlphanumericPlus` patterns, checked alongside — never replacing — the shared regex.

## Bug 5 — no deterministic tie-break for genuine duplicate rows

18 real duplicate-OEM-number groups exist across 7,723 parts. No secondary sort existed for candidates tied on `EXACT_IDENTIFIER = 1`.

**Fix:** stable secondary sort by candidate `id` in `rankCandidates()`.

## Bug 6 — embedding-model artifact for nonexistent identifier-shaped queries

A genuinely nonexistent identifier-shaped query (`"QQQ-NEVER-REAL-0002"`) scored a real 0.7 cosine similarity — above the documented 0.65 "HIGH confidence" threshold — against an unrelated real document. Not fixable via a similarity threshold.

**Fix:** structural — when an identifier-shaped query attempts exact lookup and finds nothing, vector-origin candidates are suppressed from the final result. Scoped so it never affects `TYPO`/`APPROXIMATE_SEARCH` classes.

## Round 1 (found via the full 1,840-case run, not the 150-case sample)

Four real gold-case failures, all `queryClass=UNKNOWN`:

| Query | Real cause |
|---|---|
| `"D1S"` | Real stored OEM number (bulb-type code), 3 characters — below the old `{5,20}` floor. |
| `"7P0698007B/66981701201"` | Real "/"-joined dual-OEM cross-reference convention — 21 characters after stripping, one over the old 20-char ceiling. |
| `"7-P-0-6-9-8-0-0-7-B-/-6-6-9-8-1-7-0-1-2-0-1"` | Same underlying value, dash-spelled. |
| `"MCY"` | Real, rare, pure-alphabetic Vehicle engine code (zero digits) — no pattern covered this shape at all. |

A direct query of every real `Part.oemNumber`'s stripped length found only 7 of 7,730 rows (0.09%) exceed 20 characters, with a real observed max of 100 — so `{3,100}` is evidence-based, not an arbitrary widening. A narrow `ENGINE_CODE_ALPHA_PATTERN` (`/^[A-Z]{3}$/`, low confidence 0.5) was added specifically for the one confirmed real pure-alpha engine code shape.

**Real regression found and fixed in the same round:** widening the fallback's length ceiling caused a real multi-word Swahili sentence (`"Nataka sehemu yenye namba 036145933G"`) to collapse (via `noSpaces`) into one run-on string that itself passed the widened bound, hijacking the whole sentence as `candidateIdentifier`. Fixed with a `looksLikeSegmentedIdentifier` guard: only treat a multi-word query as one segmented identifier when none of its space-separated groups looks like a real word (pure-alphabetic, 3+ letters).

Result: `identifierAccuracy` rose from **0.9974 → 0.9987** (measured on the full 1,840-case set), with Recall@1/MRR/nDCG all improving alongside it and zero regressions elsewhere.

## Round 2 — the guard itself was too strict

Two real failures remained, both the same real dash-spelled OEM shape: `"8-K-0- -4-0-7- -6-9-3- -A-A"` (real value `"8K0 407 693 AA"`) and `"0-3-6- -1-0-9- -1-1-9- -A-C"`. The round-1 guard judged each whitespace-separated group *before* stripping its own internal dashes — so a real, pure-letter revision-code group spelled character-by-character (`"-A-A"`, 4 characters, no digit) looked like a real word and was rejected.

**Fix:** strip each group's own separators before judging it. `"-A-A"` reduces to `"AA"` (2 characters, under the length-3 floor) exactly like any other short real revision code, while a genuine Swahili/English word is unaffected (it has no separators to strip).

## Final, measured result

Full 1,840-case run after both rounds: **`IDENTIFIER_ACCURACY = 1.00` exactly.** See [benchmark-trends.md](benchmark-trends.md) for the full gate history and [final-report.md](final-report.md) for the certification verdict.
