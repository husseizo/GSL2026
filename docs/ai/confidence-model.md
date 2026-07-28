# Catalogue Confidence Model

## Discrete bands, not a false-precision number

`src/catalogue-ai/confidence-model.ts`'s `computeCatalogueConfidence()` returns one of six discrete levels — `VERIFIED`, `HIGH`, `MEDIUM`, `LOW`, `CONFLICTING`, `INSUFFICIENT_EVIDENCE` — plus a `reasons: string[]` array explaining why. The spec is explicit: "Do not present numerical confidence with false precision unless calibrated." No calibration study exists for a single-decimal-place confidence number in this build, so none is presented; the band plus its real reasons is the honest representation of what's actually known.

## Priority order of checks

1. **`hasConflict` always wins first.** Any real conflicting-source signal short-circuits to `CONFLICTING` regardless of match type, verification status, or anything else — a conflict is never diluted by an otherwise-strong signal.
2. **No match type at all** → `INSUFFICIENT_EVIDENCE`.
3. **Exact match + `isVerified`** → `VERIFIED`. This is the only path to the top band, and it requires both an exact identifier match *and* independent verification — an exact match against an unverified record is `HIGH`, not `VERIFIED`.
4. **Exact match alone** (`EXACT_OEM`/`EXACT_INTERNAL_CODE`/`EXACT_ALTERNATE`/`EXACT_TECDOC`) or a **verified relationship** (`VERIFIED_SUPERSESSION`/`VERIFIED_FITMENT`) → `HIGH`.
5. **A pending manual review** on the same entity → `LOW`, regardless of how strong the underlying match otherwise looks — an open question about the record caps confidence until a human resolves it.
6. **Keyword/semantic match** → `MEDIUM` if the real retrieval score clears 0.65, else `LOW`.
7. Anything else (a possible alternative with no independent confirmation) → `LOW`.

## Why semantic answers never reach `VERIFIED`/`HIGH`

`CatalogueRagService.answerFromRag()` remaps a `HIGH`-confidence *retrieval* score (Phase 4's `computeRetrievalConfidence()`, a cosine-similarity-based signal) down to `MEDIUM` *catalogue* confidence. This is a deliberate, hard-coded ceiling, not a tuning parameter: the top two catalogue-confidence bands are reserved for match types backed by exact identifiers or verified relationships, and a semantic match — however strong its embedding similarity — is neither. This directly implements the spec's distinction between "verified facts" and "possible matches."

## Real test coverage

`confidence-model.spec.ts` covers all seven branches above, including the specific case that a manual-review-pending record is capped at `LOW` even when given a 0.9 retrieval score — proving the pending-review check runs before the score-threshold check, not after.
