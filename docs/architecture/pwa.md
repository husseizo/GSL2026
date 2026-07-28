# Phase 5 — Technician Tablet / PWA

Per the session's prioritization decision (backend platform hardened for real, one representative frontend built — the Web Management Portal; see [performance.md](performance.md) and the Web Portal section of the operational-core README), the Technician Tablet PWA has **no UI built in this round**. What exists is the API surface it would consume:

## Supporting APIs already in place

- `garage-jobs`, `inspections`, `diagnostics`, `estimates`, `labour`, `technicians`, `garage-inventory`, `quality-control` (all Phase 3) — the full job-card lifecycle a technician-facing app would drive.
- `vehicle-lifecycle`'s Digital Twin/Timeline (Phase 3/4) — vehicle history a technician would reference on-site.
- Phase 5's `branch-gateway` — the offline queue/store-and-forward mechanism a PWA running at a branch with an unreliable connection would sync through (see [branch-gateway.md](branch-gateway.md), [edge-operations.md](edge-operations.md)).
- Phase 5's `identity` module — JWT-based auth suitable for a mobile/PWA client (short-lived access token + refresh token, no session cookie dependency).

## What a PWA build would add

Service-worker-based offline caching of the current job card, local IndexedDB persistence for queued actions (photo uploads, inspection findings, time logs) taken while offline, and background sync against the Branch Gateway's queue endpoints once connectivity returns. None of this is built — it's a client application, not a backend capability, and was explicitly scoped out of this round.

## Known limitations

- No PWA manifest, service worker, or mobile-optimized UI exists.
- No offline-capable client-side data layer exists — the Branch Gateway backend is ready to be synced *against*, but nothing in this repo currently does so from a device.
