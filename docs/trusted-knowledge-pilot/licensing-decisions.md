# Licensing Decisions — Real, Named Decisions Only

## Decision 1: MolasCacheDb and Parts_Catalog treated as company-owned internal data

Confirmed with the user during planning (a real `AskUserQuestion` decision, not an assumption): both `MolasCacheDb.dbo.CacheLiquiMolyProducts` (362 real rows) and `Parts_Catalog` (TecDoc-derived parts/fitment data, 15,723 articles + 3,378,514 fitment rows) are the company's own already-in-production operational systems. They are treated as eligible under "the company's own verified transactional records" — internal AI use and embedding are allowed; export, redistribution, and model training/fine-tuning are denied pending a real external license review that has not happened yet.

**Why this matters**: neither dataset is a source this project acquired or scraped itself this phase — both were already live, internally-relied-upon systems before this pilot began. The decision scopes what the *pilot* is allowed to do with data that already existed, it does not newly authorize acquiring it.

## Decision 2 (self-imposed, refining Decision 1): Liqui Moly extraction narrowed to structured fields only

During verification, direct inspection of `CacheLiquiMolyProducts`'s own schema revealed it is a **web-scrape cache** of Liqui Moly's public product pages: columns are literally named `ScrapedAt`, `ImageUrl`, `ProductUrl`, `ProductInfoPdfUrl`, `SafetyDataSheetPdfUrl`; the `Description` column holds Liqui Moly's own marketing prose verbatim; images and PDFs are hotlinked to `liqui-moly.com` / `pim.liqui-moly.de` / `chemical-check.de`.

This does not reverse Decision 1 — it is still the company's own real, already-used-internally cache, not something newly scraped by this project. But to keep the real risk scoped exactly where the user placed it (internal AI use, no redistribution), this phase's extraction logic (`liqui-moly-extraction.ts`) **only ever extracts the structured factual specification fields**: `SpecGrade`, `Approvals`, `SpecificationItems`, `PackagingSize`, `Liter`. It explicitly and permanently excludes `Description` (marketing copy, not a verifiable technical fact) and every image/PDF URL field (hotlinked third-party media, never copied or re-served).

This narrowing is self-imposed, not a spec requirement — named here explicitly so a future reviewer understands why `Description`/`ImageUrl` were deliberately never touched, rather than assuming an oversight.

## Decision 3: No real Category B/C/D source onboarded this pilot

No authorized-supplier, licensed-catalogue, or public/regulatory source was legally cleared and acquired within this pilot's scope. This is reported as an honest gap in [source-inventory.md](source-inventory.md), not worked around by loosening what counts as "real."

## Decision 4: No model training or fine-tuning this phase

No source's permission matrix grants `USE_FOR_MODEL_TRAINING` or `USE_FOR_FINE_TUNING`. This phase never calls any training/fine-tuning API. This is a hard rule restated from the original spec, not a discovered constraint.

## Decision 5: `tecdoc_article_vehicle` sampling is a bounded, honest gap, not silent truncation

3,378,514 real fitment rows exist; this pilot processes a deterministic 50,000-edge sample (lowest `tecdoc_article_id` ordering over the already-ingested article set), via a new, additive `limit?: number` field on the existing `PartsCatalogFeedConfig`. This proves the `FITS` graph-edge mechanism end-to-end with full real provenance; it does not bulk-migrate TecDoc's entire fitment graph. Reported in [source-inventory.md](source-inventory.md) and [architecture.md](architecture.md).
