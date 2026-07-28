# Phase 5 — Identity Platform

Replaces the Phase 1–4 `x-user-role` header stand-in with real authentication, without breaking a single existing controller. See [authorization.md](authorization.md) for what happens *after* a request is authenticated, and [phase5-decision-log.md](phase5-decision-log.md) for why the migration was done as a zero-touch overlay rather than a rewrite.

## What's real here

- Password auth with `bcryptjs` hashing (slow, salted — appropriate for a low-entropy human secret), account lockout after repeated failures, forced password-change tracking (`passwordChangedAt`), and a password policy (`src/identity/password-policy.ts`) enforcing minimum length/complexity.
- JWT access tokens (15 min, `src/identity/auth-token.service.ts`) signed via `JwtKeyService` (`src/identity/jwt-key.service.ts`), which holds a *current* and *previous* signing key keyed by `kid` — a token verifies against whichever key actually signed it, so rotating `JWT_SECRET_CURRENT` doesn't invalidate every session in flight.
- Opaque refresh tokens (30 days), stored only as a SHA-256 hash (`src/identity/token-hash.ts` — fast hashing is correct here because the token itself is a high-entropy random secret, unlike a password). Refresh tokens carry a `familyId`; reusing an already-rotated token revokes the whole family (theft detection).
- TOTP MFA (`src/identity/mfa.ts`, `otplib` v13's async top-level API) — secret encrypted at rest with AES-256-GCM (`src/common/crypto/field-encryption.ts`), enrolled via `/auth/mfa/enroll` → `/auth/mfa/confirm`, required at login once enabled.
- Session management: `UserSession`/`RefreshToken` rows, `/auth/sessions` (list), `/auth/sessions/:id/revoke`, full `LoginHistoryEntry` audit trail (`/auth/login-history`).
- Device registration (`TrustedDevice`), password reset (`PasswordResetToken`, one-time, hashed, time-boxed) and email verification (`EmailVerificationToken`) tokens, both single-use and hash-stored the same way as refresh tokens.
- API keys and service accounts (`src/identity/api-keys.service.ts`/`.controller.ts`) — machine identities authenticate with `Authorization: ApiKey <key>` instead of a JWT, resolved by the same guard.

## How it plugs into every existing controller without touching them

`getRequestActor()` (`src/common/permissions/request-actor.ts`) is the one function every Phase 1–4 guard/controller already calls to find out who's making a request. Phase 5 adds a **global** `JwtAuthContextGuard` (`src/identity/jwt-auth-context.guard.ts`, registered via `APP_GUARD` in `identity.module.ts`) that runs before any route handler: if the request carries a valid `Authorization: Bearer <jwt>` or `ApiKey <key>`, it verifies it and attaches a `verifiedActor` to the request object. `getRequestActor()` checks `request.verifiedActor` first and only falls back to parsing `x-user-role`/`x-branch-id`/`x-warehouse-id` headers if there isn't one — same return shape either way. Every existing `@UseGuards(RolesGuard)` controller from Phases 1–4 is unmodified and works identically with either a real JWT or the legacy header.

## OAuth2/OIDC

Not implemented against a real external IdP (no external directory reachable from this environment) — `identity.module.ts` structures token issuance/verification behind `AuthTokenService` specifically so a future OIDC provider is a new strategy alongside password auth, not a rewrite of session/refresh/MFA plumbing.

## Endpoints (`src/identity/identity.controller.ts`)

`POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/mfa/enroll`, `/auth/mfa/confirm`, `/auth/mfa/disable`, `/auth/password-reset/request`, `/auth/password-reset/confirm`, `/auth/email-verification/request`, `/auth/email-verification/confirm`, `GET /auth/sessions`, `PATCH /auth/sessions/:id/revoke`, `GET /auth/login-history`, `GET /auth/users` (admin), `PATCH /auth/users/:id/active` (admin).

## Tests

`identity.integration-spec.ts` (13 tests, real Postgres — register/login/refresh rotation/theft-detection/MFA enroll+confirm+require/lockout/reset/verification/sessions/history), `mfa.spec.ts`, `password-policy.spec.ts`, `token-hash.spec.ts` — all real, no mocked crypto.

## Known limitations

- No real SSO/SAML/OIDC against an external directory — see above.
- Rate limiting on `/auth/login` reuses the general API rate limiter (`src/api-platform/api-rate-limit.guard.ts`), not a login-specific throttle with progressive backoff.
- Email/SMS delivery for verification and password reset is the same honest `ConsoleLogProvider` stand-in described in [notifications.md](notifications.md) — no real mail server in this environment.
