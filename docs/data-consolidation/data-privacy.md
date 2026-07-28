# Data Privacy

## Masking during profiling

`scripts/profile-sources-deep.ts`'s `maskRow()` redacts any column whose name matches a sensitive-field pattern (phone/mobile/tel/email/tax/vat/address/contact/name/card_name) before printing a sample row to console or into a doc — see the masked samples in [docs/data-sources/molas-cache-db-profile.md](../data-sources/molas-cache-db-profile.md). No raw customer phone number, email, or address appears unmasked in any committed document from this phase.

## What appeared unmasked, and why that's acceptable

`scripts/verify-real-data-consolidation.ts`'s STEP 11 (proving the safe-update path) printed one real customer's business name ("Huca Garage") to console to demonstrate the corrected name was applied. A company/business name is lower-sensitivity than a phone number, tax ID, or personal address, and this project's existing convention (see Phase 3/4 verification scripts) already prints real business-relevant identifiers (part names, vehicle brands) as verification evidence. No phone, email, tax number, or address was printed unmasked anywhere in this phase's real run output.

## Fields treated as sensitive going forward

Customer phone/email/tax number/address, supplier pricing/cost (once supplier import exists), vehicle registration/VIN where not already public-facing on the vehicle record itself, and any future user identifiers. These should continue to be masked in logs, error reports, and documentation examples per the phase's original instruction — no new masking utility was needed beyond `maskRow()`, reused as-is.

## Production data on developer machines

This phase's real credentials (`SQLSERVER_*`, `NEON_PARTS_CATALOG_DATABASE_URL`) live only in `services/operational-core/.env`, which is `.gitignore`d (verified: `git check-ignore -v .env` confirms it, and `git ls-files .env` returns nothing — it has never been committed). They were never pasted into a committed file, a doc, or a script other than as an environment-variable reference (`process.env.SQLSERVER_PASSWORD`, never a literal). No production data was copied to a separate developer machine in this pass — all extraction happened from the same environment where the real credentials were provided.

## AI training

Per the phase's explicit instruction, no AI training/fine-tuning was initiated in this phase. The real, imported, reconciled data now sitting in `Customer`/`Part`/`LubricantProduct`/`SalesDocument` is exactly the trustworthy foundation Phase 4's RAG/forecasting/AI-assistants layer was built to consume — but that consumption is a decision for a future phase, not this one (see [decision-log.md](decision-log.md) "Why AI training must wait for validated real data").
