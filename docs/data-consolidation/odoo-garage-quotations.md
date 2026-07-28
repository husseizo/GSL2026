# Odoo Garage Quotations

**Not implemented in this pass — no real, reachable source was confirmed.** See [docs/data-sources/odoo-garage-profile.md](../data-sources/odoo-garage-profile.md) for exactly what was attempted (no local Odoo instance, the "Molaslubes" Neon database name given for this purpose doesn't exist at the provided host, and it was subsequently described as a lubricants-cache replica target, not an Odoo/garage source).

## What the pipeline is ready for

`OdooGarageQuotationAdapter` was never written, since writing it against an unconfirmed schema would mean guessing table/column names — exactly what the phase's own rule against blind mapping forbids. When real access is confirmed, the adapter slots into the same pattern as `MolasLubricantsCacheAdapter`/`PartsCatalogAutoHubAdapter` (implement `EnterpriseSourceAdapter`, feed through `StagingService`, normalize, match, import) — no new pipeline machinery is needed, only the adapter itself plus the quotation-status mapping described below (still valid design guidance even though not yet executable).

## Quotation status mapping (design, not yet implemented)

Once real Odoo quotation data is reachable, quotation statuses should map into: `DRAFT_DEMAND`, `SENT_TO_CUSTOMER`, `CUSTOMER_REVIEW`, `APPROVED_COMMERCIAL_DEMAND`, `REJECTED`, `EXPIRED`, `CANCELLED`, `CONVERTED` — never automatically converted into a completed `GarageJob` (Phase 3). A quotation is commercial/demand evidence; a job card is a real workshop event with real technician/inspection/QC records behind it. See [pwa.md](../architecture/pwa.md)'s sibling note in Phase 5 and the garage-data-limitations rule below.

## Garage-data limitations (unchanged from the original brief, still true)

Full garage operational data (completed inspections, technician assignments, DTC history, road tests, QC results, actual labour/parts/lubricant consumption, repeat repairs) is not available from any confirmed real source yet. Nothing in this phase fabricates any of it. Once Odoo quotation access is confirmed, quotations may populate customer demand, a proposed vehicle/repair/part/lubricant/labour, commercial value, and quote-to-invoice conversion tracking — never a completed job record.
