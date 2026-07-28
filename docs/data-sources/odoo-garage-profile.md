# Source Profile — Odoo Garage Quotations

**Status: real access not yet configured. Nothing in this document was verified against a live Odoo instance or a live SAP↔Odoo middleware endpoint — reported honestly rather than fabricated**, per this phase's explicit rule against simulating source connectivity.

## What was attempted

1. Checked for a locally-running Odoo instance on this machine (the same server hosting `MolasCacheDb`/`MOLAS_Live_2021_Cache`): no Odoo process found, TCP port 8069 (Odoo's default) closed. Odoo is not co-located with the SAP cache databases.
2. Asked the user how the SAP↔Odoo middleware is reached. The answer pointed at a Neon Postgres database named `Molaslubes`, described as saving data "from MolasCacheDb" — i.e. a **lubricants** replica target, not a garage-quotations source.
3. Attempted to connect to `Molaslubes` at the given Neon host: the connection to the Neon endpoint succeeded, but **the database `Molaslubes` does not exist there**.

## Current conclusion

There is no confirmed, reachable source for Odoo garage quotations in this environment as of 2026-07-12. `MolasCacheDb` (see [molas-cache-db-profile.md](molas-cache-db-profile.md)) is confirmed to be a real SAP↔Odoo bridge, but for **lubricants commercial documents** (sales orders, invoices, deliveries, payments) — not for garage/workshop quotations, which is a distinct Odoo domain (quotations, quotation lines, vehicle references, service/labour lines).

## What is needed to unblock this

- Either the correct database name/host for the `Molaslubes` Neon database (if it does hold garage-quotation data despite its lubricants-suggestive name), or
- Direct Odoo XML-RPC/JSON-RPC API access (base URL, database name, API user, API key), or
- A different, correctly-named read-only replica of Odoo's own database.

## What this means for this phase

Per the original brief's own explicit instruction ("Explicitly recognize that full garage operational data is not yet available... do not fabricate"), garage-quotation ingestion (`OdooGarageQuotationAdapter`) is **deferred** in this pass. This phase proceeds with the two confirmed-real sources — lubricants (`MolasCacheDb`) and spare parts/VIN catalog (`Parts_Catalog`/AutoHub/TecDoc) — and documents this gap rather than guessing at an Odoo schema that hasn't been inspected. See [decision-log.md](../data-consolidation/decision-log.md).
