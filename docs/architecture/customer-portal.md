# Phase 5 — Customer Portal

Same scoping decision as [pwa.md](pwa.md): backend APIs a customer portal would consume are real and tested; no customer-facing UI was built this round.

## Supporting APIs already in place

- `estimates`' customer-approval flow (Phase 3, `PATCH /estimates/approval-requests/:id/respond`) — already the exact endpoint a customer portal's "approve this repair line" button would call; it doesn't assume an internal staff user, only an actor with the approval-request's token/identity.
- `vehicle-lifecycle`'s Digital Twin/Timeline — a customer's own vehicle history, health score, predicted maintenance (Phase 3/4).
- Phase 5's `notification-service` preferences (`GET`/`PUT /notifications/preferences`) — a customer could manage their own SMS/email/push opt-ins through the same endpoints a staff user does.
- Phase 5's identity platform — registration/login/MFA/sessions all work for any actor, not just staff; the missing piece is a customer-scoped role and a UI, not new auth machinery.

## What's missing for a real customer portal

A `CUSTOMER` role with narrowly-scoped permissions (see [authorization.md](authorization.md) — the policy engine already supports a new role with a restricted permission set; none has been defined for customers yet), a customer-to-vehicle ownership link enforced via `isOwner()`, and the UI itself.

## Known limitations

- No `CUSTOMER` role exists in `ROLE_PERMISSIONS` yet.
- No customer-facing UI exists.
- No public-facing (unauthenticated marketing/booking) pages — this doc only covers the authenticated-customer API surface.
