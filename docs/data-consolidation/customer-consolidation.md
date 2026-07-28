# Customer Consolidation

`src/data-consolidation/matching/customer-matching.service.ts` — real match-level rules against the existing `Customer`/`CustomerExternalReference` tables (Phase 2, unchanged).

## Match levels

- **EXACT**: an existing `CustomerExternalReference` for this exact `(sourceSystem, sourceRecordId)` already exists (an update, not a new match); a real tax-number match; or matching phone **and** identical normalized name.
- **HIGH_CONFIDENCE**: matching email plus a similar (not necessarily identical) normalized name.
- **POSSIBLE_MATCH**: normalized-name similarity alone. **Never auto-merged** — always routed to `ManualReviewItem` (queue `CUSTOMER_MATCH`).
- **CONFLICT**: same phone, but a different name than the existing customer on record — a real contradiction, not silently resolved either way.
- **NO_MATCH**: nothing above fired, or the source record is a known generic/walk-in code (see below) — a new `Customer` is created.

## Normalization (`src/data-consolidation/normalize.ts`)

- `normalizePhone()` — keeps a leading `+` and digits only, so `"+255 712 345 678"` and `"+255712345678"` compare equal.
- `normalizeCompanyName()` — lowercases, strips `ltd`/`limited`/`llc`/`inc`/`co`/`company` and punctuation, collapses whitespace.
- `normalizeTaxNumber()` — uppercases, strips punctuation.
- `isGenericCustomerCode()` — real generic/walk-in codes found during profiling (`"0001"`, `"00000000"`, `"b00000000"`, `"cash"`, `"walkin"`) are never treated as a real party identity signal, so hundreds of unrelated walk-in sales never get silently merged into one fictional "customer."

## Real result (2026-07-12, `MOLAS_CACHE_LUBRICANTS_CUSTOMERS`, 4,247 real customers)

- 3,992 created new
- 14 matched an existing customer and were updated in place
- 241 (≈5.7%) were real ambiguous matches (POSSIBLE_MATCH/CONFLICT) — correctly routed to manual review rather than guessed
- 0 errors

## Preserved fields

Original name, normalized name (implicit via the matching function, not persisted separately on `Customer` in this pass), original phone, normalized phone (used only for comparison), source customer code (`CustomerExternalReference.sourceRecordId`), source system, pricing group. Credit metadata (`CreditLimit`/`OutstandingBalance` in the real source) is present in the raw payload but not yet mapped onto `Customer` — deferred, since `Customer.creditLimit` semantics need confirming against the real source's actual meaning before import (see [decision-log.md](decision-log.md)).
