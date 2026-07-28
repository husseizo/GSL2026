# Real Source Inventory

## Production sources onboarded this pilot

| Source | Category (spec §2) | Real row count | Status |
|---|---|---|---|
| `INTERNAL_WORKSHOP_SOPS` | A — company-owned | 8 self-authored Markdown documents | APPROVED |
| `MOLAS_CACHE_LUBRICANTS` (`MolasCacheDb.dbo.CacheLiquiMolyProducts`) | A — company-owned operational cache | 362 real rows | APPROVED |
| `PARTS_CATALOG_AUTOHUB_TECDOC` (`Parts_Catalog.tecdoc_article` + `.tecdoc_article_vehicle`) | A — company-owned operational data | 15,723 articles; 3,378,514 fitment rows (50,000-edge bounded sample ingested) | APPROVED |
| `GARAGE_VERIFIED_REPAIR_CASES` (`DiagnosticSession` + `InspectionResult`) | A — company-owned internal case records | 7 real rows (5 + 2) | APPROVED |

## Honest gap: source category coverage

The spec asks for 5+ source categories. This pilot's **real, onboarded** corpus contains only **Category A (company-owned)** sources — no real Category B (authorized supplier), Category C (licensed catalogue), or Category D (public/regulatory) source was actually acquired and onboarded this phase, because no such source was legally cleared and available within the pilot's timeframe. Categories B/C/D of the permission matrix, acquisition pipeline, and quarantine mechanism are exercised only through the verify script's synthetic transient fixtures (`Verify Supplier Source ...`, `Verify Restricted Source ...`, `Verify Licensed OEM Source ...`), proving the *mechanism* handles all four categories correctly — not that four real categories of content exist in the trusted snapshot today. This is reported here plainly rather than hidden; closing it is future work (real supplier/licensed source acquisition), not something this pilot fabricated to hit a target.

## Self-imposed narrowing on `MOLAS_CACHE_LUBRICANTS`

`CacheLiquiMolyProducts` is a real, already-in-production internal cache — but its own columns (`ScrapedAt`, `ImageUrl`, `ProductUrl`, `ProductInfoPdfUrl`) reveal it as a web-scrape cache of Liqui Moly's own public pages, not a licensed feed. Per the user's confirmed decision (company-owned internal data, internal AI use allowed, export/redistribution denied pending real license review), and as a further self-imposed narrowing documented in [licensing-decisions.md](licensing-decisions.md), only the structured factual fields (`SpecGrade`, `Approvals`, `SpecificationItems`, `PackagingSize`, `Liter`) are extracted as knowledge content. Liqui Moly's own marketing `Description` text and all hotlinked image/PDF URLs are never extracted.

## See also

[source-permission-matrix.md](source-permission-matrix.md), [licensing-decisions.md](licensing-decisions.md).
