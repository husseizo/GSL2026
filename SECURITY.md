# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Report it privately using one of the following:

1. **GitHub private vulnerability reporting** — if enabled on this repository, use the "Report a vulnerability" option under the Security tab.
2. **Direct contact** — email the repository owner (see the GitHub profile of the repository owner, `husseizo`) with a clear description of the issue, real steps to reproduce it, and its potential impact.

Please include:

- A clear description of the vulnerability and its real, potential impact.
- Steps to reproduce it (or a proof of concept, if safe to share privately).
- The affected component (`services/operational-core`, `services/dgx-ai-platform`, or `services/web-portal`) and, if known, the specific file/endpoint.

We will acknowledge receipt as soon as practical and work with you on a fix before any public disclosure.

## Scope

This policy covers the AIOS codebase in this repository: `services/operational-core` (NestJS backend), `services/dgx-ai-platform` (FastAPI inference boundary), and `services/web-portal` (React frontend). It does not cover the external, read-only source systems AIOS integrates with (SAP Business One, Odoo, TecDoc) — those are third-party systems outside this repository's control.

## Known, honestly-documented security posture

AIOS does not hide known gaps. As of this writing, the Enterprise Roadmap's own Risk Roadmap (`docs/strategy/AIOS_ENTERPRISE_ROADMAP_V1.md` §16) documents:

- A legacy `RolesGuard` still present on a few routes, alongside the current, real permission-based `PermissionsGuard` model.
- A non-rejecting global JWT guard in some paths.

Both are named there as gaps that must be closed before broad exposure of any new capability — check that document for the current status before assuming either has been resolved.

## Real security controls already in place

- Bearer JWT and `x-api-key` authentication (`api-platform/`), enforced via `PermissionsGuard` on business routes (verified directly: protected routes return `403` without valid credentials).
- Branch/warehouse/tenant scope enforcement on data access (`TenantContextService`, `organizationId`/`branchId` scoping).
- Immutable audit logging for every recommendation lifecycle event and forecast generation (`common/audit/`).
- No external source system is ever written to — all integration adapters are read-only by code discipline (see `docs/data-consolidation/decision-log.md`).
- Encryption at rest for sensitive document content (`knowledge-platform/security/`), and a document-ingestion-specific prompt-injection scanner.

## Supported Versions

This repository does not yet have a tagged release — see [`docs/release-strategy.md`](docs/release-strategy.md) for the versioning and support-lifecycle policy that will apply once releases begin. Until then, only the current `main` branch is supported.
