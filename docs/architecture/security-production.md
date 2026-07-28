# Phase 5 — Production Security

## Secrets management

All secrets (`JWT_SECRET_CURRENT`, `ENCRYPTION_KEY`, `BRANCH_GATEWAY_SIGNING_KEY`, database URLs, etc.) come from environment variables, validated at boot by `env-validation.ts`'s Joi schema (`envValidationSchema`), wired into `ConfigModule.forRoot({validate: validateEnv})` — the application refuses to start with a missing/malformed required secret rather than limping along and failing confusingly later. No secrets vault (Vault/AWS Secrets Manager) integration — env-var-based, appropriate for this build, structured so a vault-backed env-loader is a startup-script change, not an application change.

## Key rotation

`JwtKeyService` (see [identity-platform.md](identity-platform.md)) holds current + previous signing keys by `kid` — rotating `JWT_SECRET_CURRENT` doesn't invalidate tokens signed moments before under the previous key.

## Certificate management

`src/security/self-signed-cert.ts`'s `generateSelfSignedCertificate()` (the `selfsigned` package, async API) generates a real X.509 cert + PKCS8 private key — validated by actually starting a Node `https` server with it and connecting via `https.request({rejectUnauthorized: false})` (Node's native `fetch()` does not honor per-call TLS bypass in this Node version, so the test uses `https.request` directly, the standard correct approach). For a real deployment this is a local-dev/internal-service convenience, not a substitute for certificates from a real CA (Let's Encrypt, etc.) on public-facing endpoints.

## Secure headers / CSP / CSRF

`helmet()` applied globally in `main.ts` — sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, etc. with helmet's secure defaults. CSRF protection relies on the JWT-bearer-token model (no cookie-based session auth for API clients, so classic CSRF doesn't apply the same way it would to a cookie-authenticated app) — the Web Portal stores tokens in memory/localStorage and sends them as an `Authorization` header, not a cookie.

## Audit retention / immutability

Real Postgres-level enforcement, not just application-level convention: `prisma/migrations/20260712083533_audit_log_immutability/migration.sql` installs a `BEFORE UPDATE OR DELETE` trigger on `AuditLog` that raises an exception — verified in `audit-log-immutability.integration-spec.ts` (3 tests) by attempting a real `UPDATE`/`DELETE` against `AuditLog` and confirming Postgres itself rejects it, not just that application code declines to call update/delete.

## Sensitive-data masking

`redactSensitiveFields()` (`src/common/logging/redact.ts`) — pure recursive redaction applied in `request-logging.middleware.ts` so passwords/tokens/secrets never reach a log line.

## Encryption

At rest: `encryptField()`/`decryptField()` (AES-256-GCM, `src/common/crypto/field-encryption.ts`) for MFA secrets and config backups — key derived via SHA-256 from `ENCRYPTION_KEY`. In transit: TLS via the self-signed-cert mechanism above for local/internal use; a production deployment would terminate TLS with a real CA-issued certificate, typically at a load balancer/ingress in front of this application.

## Security event logging

`SecurityEvent` model + writes on notable events (failed logins triggering lockout, MFA disable, session revocation) — queryable via `security.read` permission (see [authorization.md](authorization.md)).

## Tests

`env-validation.spec.ts` (6 tests), `redact.spec.ts` (6 tests), `self-signed-cert.spec.ts` (2 tests, one starts a real HTTPS server), `audit-log-immutability.integration-spec.ts` (3 tests, real Postgres trigger rejection).

## Known limitations

- No secrets vault integration — env vars only.
- No public-CA certificate issuance/renewal automation (no real internet-facing deployment exists to issue one for).
- CSP policy uses helmet's defaults, not a hand-tuned policy for the Web Portal's specific script/style sources.
