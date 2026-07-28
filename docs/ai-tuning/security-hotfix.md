# Security Hotfix — Identity Response Sanitization

Treated as a blocking requirement before any AI tuning work, per this phase's own instructions.

## The original finding

The DGX Prototype 1 Final Acceptance Report's own live-system validation surfaced a real, confirmed leak: `POST /auth/register` returned the raw Prisma `User` row, including `passwordHash` (a real bcrypt hash) and `mfaSecretEncrypted` (AES-256-GCM ciphertext of a TOTP secret), directly in the HTTP response body.

## The full audit and what else was found

Auditing every identity-related response for the same class of issue (raw ORM entity returned instead of an explicit safe shape) found two more real instances, not previously documented:

1. **`ApiKeysService.create()`** returned `{ ...record, fullKey }` — spreading the entire raw `ApiKey` row, including `keyHash` (the hash of the raw API key), into the response alongside the intentionally-shown-once plaintext `fullKey`.
2. **`ApiKeysService.list()`/`revoke()`** returned raw `ApiKey[]`/`ApiKey` rows directly, including `keyHash` for every key — meaning anyone with `apikeys.manage` permission listing keys saw every key's hash.
3. **`IdentityController.requestEmailVerification()`** returned the raw email-verification token directly in the HTTP response to the same authenticated caller who requested it — defeating the actual security purpose of email verification (proving control of the mailbox via an out-of-band channel), even though the token wasn't exposed to an *unauthorized* party.

Endpoints reviewed and confirmed already safe (no change needed): `login()`/`refresh()` (return `AuthTokens` only — `{accessToken, refreshToken, expiresIn}`, no entity), `listSessions()`/`listLoginHistory()` (return `UserSession`/`LoginHistoryEntry` rows directly, but neither model carries any hash/secret field), `enrollMfa()` (returns the plaintext TOTP secret once, by design — correct UX, distinct from the encrypted-at-rest `mfaSecretEncrypted`), `listUsers()`/`setUserActive()` (already used an explicit Prisma `select`, now additionally given a typed `UserSafeView` return type for compile-time safety), `requestPasswordReset()` controller (already discarded the raw token and returned a generic message — the correct pattern `requestEmailVerification()` now also follows).

Also checked and confirmed to carry no secret/credential fields: `IntegrationSource`, `AiModel` (no source-system or model-provider credentials are stored in these tables — real DB/API credentials live in environment variables, never in a queryable row).

## The fix

- **`USER_SAFE_SELECT`** (`src/identity/dto/auth.dto.ts`) — a Prisma `select` clause covering exactly `id, email, name, role, branchId, isActive, isEmailVerified, mfaEnabled, createdAt, updatedAt`. `IdentityService.register()` now uses it, so the sensitive columns are **never fetched from the database** for this response, not fetched-then-stripped.
- **`API_KEY_SAFE_SELECT`** (`src/identity/api-keys.service.ts`) — same pattern, excluding `keyHash`. Applied to `create()` (still returns `fullKey` separately, the one legitimate plaintext-secret exposure), `list()`, and `revoke()`.
- **`requestEmailVerification()`** — the controller now discards the service's return value and always responds with a generic `{ message: 'A verification email has been sent.' }`, matching `requestPasswordReset()`'s existing pattern exactly.
- Explicit `UserSafeView`/`ApiKeySafeView` TypeScript interfaces give every one of these methods a real, checked return type — a future accidental widening back to the full entity would be a type error, not just a missed code-review comment.

No global `ClassSerializerInterceptor`/response interceptor was introduced — the existing codebase convention (Prisma `select` clauses, not decorator-based serialization) was extended consistently rather than introducing a second sanitization mechanism.

## Regression tests

`identity.integration-spec.ts`:
- `register()` test now asserts `passwordHash`/`mfaSecretEncrypted`/`failedLoginCount`/`lockedUntil`/`passwordChangedAt` are absent from the response object, asserts the exact real key set the response contains, and separately confirms via a direct database query that the password hash *is* still real and correctly stored (proving the fix didn't also break real password storage).
- `ApiKeysService` test now asserts `keyHash` is absent from `create()`/`list()`/`revoke()` results.

Both tests pass. Verified live over HTTP as well: a real `POST /auth/register` call against the running backend, before and after the fix, confirmed the exact before/after response shape difference.

## Addendum — a related input-validation gap, found via real live usage

While a real user was testing the fixed `/auth/register` endpoint through Swagger, an empty request body (`-d ''`, no `Content-Type`) produced a raw `500 INTERNAL_ERROR` exposing Prisma's full internal query structure (every `User` model field and relation name) instead of a clean validation error. Root cause: `RegisterDto` was a plain TypeScript interface, not a class — NestJS's global `ValidationPipe` (`main.ts`, `whitelist: true, transform: true`) only validates `@Body()` parameters whose reflected type is a real class; a plain interface is erased at compile time and reaches the pipe as generic `Object`, which it explicitly skips. The malformed body sailed straight through to `this.prisma.user.findUnique({ where: { email: undefined } })`, which Prisma correctly rejected — but as an unhandled exception, not a validation error.

**Fix**: `RegisterDto` (`src/identity/dto/auth.dto.ts`) is now a real class with `class-validator` decorators (`@IsEmail()`, `@IsString()`, `@IsEnum(Role)`, `@IsOptional()`), matching the exact convention already used by every other DTO in this codebase (e.g. `CreateCustomerDto`). No `main.ts` change was needed — the global `ValidationPipe` was already correctly configured; it simply had nothing to validate before.

**Verified two ways**:
- `auth.dto.spec.ts` (5 real tests, `class-validator`'s own `validate()` against `plainToInstance(RegisterDto, ...)`): an empty body produces real errors on `email`/`name`/`password`/`role`; an invalid email string and an invalid role value are each individually rejected; a complete valid payload (with and without the optional `branchId`) produces zero errors.
- Live, against the running backend: the user's exact original request (`curl -X POST /auth/register -d ''`) now returns a clean `400 BadRequestException` listing which fields are invalid, not a `500`. A real, complete registration request immediately afterward still succeeds (`201`, safe response shape) — confirming no regression.

`LoginDto`/`RefreshDto` have the same underlying issue (plain interfaces, same class of gap) and were **not** fixed this pass — out of scope for the specific `RegisterDto` fix requested. Noted here as a known, analogous, unaddressed gap.

## Remaining security risks (honest, not fixed this phase)

No response-shape automated test exists yet for every other entity type across the platform beyond identity (session/audit views were checked manually this phase, not covered by an automated shape-assertion test suite). No global response-serialization guard exists to catch a *future* accidental leak in a module this audit didn't touch — the fix here is scoped to identity, per this phase's "only evaluation/security-hotfix/pilot-readiness work" rule.
