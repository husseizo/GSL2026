# Phase 5 — Dealer & Wholesale Portal

Same scoping decision as [pwa.md](pwa.md)/[customer-portal.md](customer-portal.md): supporting APIs are real; no dealer-facing UI built this round.

## Supporting APIs already in place

- `purchases`/`suppliers`/`purchase-recommendations` (Phase 2) — a wholesale/dealer-facing ordering flow would sit on top of these existing document-import and recommendation endpoints.
- Phase 5's `integration-adapters` (SAP B1/Odoo, see [integration-adapters.md](integration-adapters.md)) — the adapter pattern used for supplier-system connectivity is the same shape a dealer/wholesale B2B integration would use: authenticate, fetch, map into the existing sync pipeline, never write directly into Operational Core.
- Phase 5's API platform (Swagger/SDKs, see [api-platform.md](api-platform.md)) — a dealer/wholesale partner integrating programmatically (rather than through a UI) already has a real, versioned, documented API plus generated TypeScript/.NET/Python SDKs to build against.

## What's missing for a real dealer portal

A `DEALER`/`WHOLESALE` role and permission set (none defined yet), a dealer-to-organization or dealer-to-branch relationship model (not built — the current org hierarchy assumes internal branches, not external partner accounts), and the UI itself.

## Known limitations

- No dealer/wholesale role, no external-partner account model, no dealer-facing UI.
- Nothing in this build distinguishes "a branch" from "an external dealer account" — that distinction would need real modeling before a dealer portal could be built on top of the existing branch-scoped APIs without leaking internal branch data.
