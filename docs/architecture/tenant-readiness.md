# Phase 5 — Multi-Tenant Readiness

Phase 5 does **not** convert AIOS into a multi-tenant SaaS product. It prepares the org boundary so that becoming one later is a configuration exercise, not a rewrite — consistent with the spec's explicit instruction.

## What exists

- `OrganizationConfiguration` (`prisma/schema.prisma`) — one row per `Organization`, holding feature flags, locale, timezone, currency, and branding fields (name/logo URL/primary color) as a JSON/typed config blob. `src/tenancy/organization-configuration.service.ts`/`.controller.ts` — CRUD scoped to `organizationId`.
- `TenantContextService` (`src/tenancy/tenant-context.service.ts`) — `assertBranchBelongsToOrganization(branchId, organizationId)`, a single guard-rail function called wherever a request's branch and organization both matter, to catch a request that names a branch belonging to a *different* organization (a real cross-tenant leak in a genuinely multi-tenant future, and a real data-integrity bug even today with one organization).
- Every model that matters for isolation already carries `organizationId`/`branchId` from Phases 1–3 (`Vehicle`, `Part`, `GarageJob`, inventory tables, etc.) — Phase 5 didn't need to add tenant columns retroactively, only the assertion helper that uses them consistently.

## Why this is "readiness," not "multi-tenant"

There is one organization in this build's data, and no per-tenant database/schema isolation, connection-pool partitioning, or tenant-aware rate limiting. What Phase 5 adds is the *shape* a real tenant boundary would need — a config table keyed by organization, and a single reusable assertion function — so that when a second real organization is onboarded, the work is "wire up tenant resolution from the auth token" rather than retrofitting `organizationId` checks across every module.

## Tests

`tenancy.integration-spec.ts` (4 tests, real Postgres) — config CRUD, cross-organization branch assertion rejection.

## Known limitations

- No tenant-scoped rate limiting, no per-tenant database routing, no tenant resolution middleware (organization is still resolved the same way branch/warehouse always have been — from the request actor, not a subdomain/header dedicated to tenancy).
- Localization/timezone/currency fields exist on `OrganizationConfiguration` but nothing in the API layer yet formats responses using them — they're stored, not yet consumed.
