# Extraction Profiles

## Model

`ExtractionProfile` (new, additive Prisma model): `documentType String`, `version Int`, `fieldRules Json`, `isActive Boolean`, unique on `(documentType, version)`. Versioned per document type so a profile can evolve without losing history — the existing shape's own convention (favor a JSON+version pair over a proliferation of new enums/tables).

## 11 seed profiles (`seed-profiles.ts`)

`LUBRICANT_TDS`, `LUBRICANT_PDS`, `SAFETY_DATA_SHEET`, `PARTS_CATALOGUE`, `FITMENT_EXPORT`, `TECHNICAL_BULLETIN`, `WORKSHOP_SOP`, `DIAGNOSTIC_PROCEDURE`, `WARRANTY_POLICY`, `INTERNAL_CASE_RECORD`, `PRODUCT_SUPERSESSION_NOTICE` — each with required metadata fields, expected sections, candidate entity/claim/structured-fact rules, validation rules, high-risk field list, required approval roles, rejection rules, and evaluation cases, per spec §14.

`ExtractionProfileService.seedAll()` is idempotent — re-running it does not duplicate or corrupt existing profile versions (verified directly, `seed-profiles.spec.ts`).

## Real usage

All 11 profiles are seeded and active in the live database. `getActiveProfile(documentType)` resolves the current version; `createProfile()` and `listVersions()` support real profile evolution without breaking already-extracted content's provenance links.
