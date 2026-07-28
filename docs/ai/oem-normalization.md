# OEM / Identifier Normalization for Catalogue Search

## Deliberately separate from `src/parts/normalize.ts`

`src/catalogue-ai/search/identifier-normalization.ts` is a new, independent module — it does **not** touch or call `normalizeOemNumber()` in `src/parts/normalize.ts`. That function is matching-critical: `PartMatcherService`/duplicate-consolidation logic use it to decide whether two source records describe the *same real canonical part*, and a change there directly changes which real parts get merged. This phase's normalization exists only to widen what a *search query* matches against — it is safe to be permissive here in a way it would not be safe to be permissive there. Conflating the two would mean a search-convenience change could silently start merging distinct canonical entities.

## Three strengths, original always preserved

```ts
interface NormalizedIdentifier {
  original: string;              // never discarded
  strict: string;                // uppercase + trim only — safe for any identifier
  relaxed: string;                // strict + spaces/hyphens/dots/slashes stripped
  leadingZerosStripped: string;   // relaxed + leading zeros stripped, numeric-only
}
```

`identifiersMatch(a, b)` returns `{ matched, strength: 'STRICT' | 'RELAXED' | 'NONE' }`. `CatalogueSearchService.findByOemNumber()` tries `strict` first (returned as a full-confidence `EXACT_OEM` match, score 1.0); only if that finds nothing does it fall back to a `relaxed` comparison across the whole `Part` table, and that fallback is always scored lower (0.9) and never presented as an unqualified exact match.

## Leading zeros: numeric-only, opt-in

Leading-zero stripping (`00123456` → `123456`) is applied **only** when the relaxed form is all-digits. An alphanumeric code like `0A1234` is never touched — stripping its leading zero could conflate it with an entirely different supplier's `A1234`. This is enforced by a real regex guard (`/^\d+$/.test(relaxed)`), not a convention documented but unenforced, and covered directly by `identifier-normalization.spec.ts`'s "never strips leading zeros from an alphanumeric code" test.

## Documented supplier prefixes: currently empty, on purpose

`stripDocumentedSupplierPrefix()` exists as a real seam for supplier-specific prefix conventions, but `DOCUMENTED_SUPPLIER_PREFIXES` is intentionally an empty array. No supplier-prefix convention has actually been confirmed in this project's real imported data — inventing one to make the function "do something" would risk merging genuinely distinct part numbers from different suppliers on a guess. This stays empty until a real, evidenced prefix convention is found and documented here with its supporting evidence.

## Real examples used in tests

`identifier-normalization.spec.ts` and `catalogue-search.integration-spec.ts` use real-shaped OEM formats seen in the imported AutoHub catalogue (e.g. `04E-115-561-H` written with hyphens vs. without) rather than invented placeholder strings, so a normalization regression would show up against the actual formatting variation this catalogue exhibits.
