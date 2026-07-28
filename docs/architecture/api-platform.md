# Phase 5 — API Platform

Turns the existing REST surface (Phases 1–4) into a documented, versioned, machine-consumable platform without changing any handler's business logic.

## OpenAPI / Swagger

`src/main.ts` wires `@nestjs/swagger`'s `DocumentBuilder`/`SwaggerModule.setup('api-docs', ...)`, with `nest-cli.json`'s `@nestjs/swagger/plugin` doing automatic DTO schema extraction (no manual `@ApiProperty()` annotation of every existing DTO required). `scripts/generate-openapi.ts` generates `openapi.json` standalone (no HTTP listener needed) — confirmed **245 real documented paths** covering every module through Phase 5.

## Versioning

`app.enableVersioning({type: VersioningType.URI, defaultVersion: VERSION_NEUTRAL})` — existing Phase 1–4 routes remain reachable unversioned (`VERSION_NEUTRAL`), so no existing client breaks; new Phase 5 endpoints can opt into `/v1/...` if a future breaking change needs it. No breaking change has shipped yet, so nothing is versioned beyond neutral today — the mechanism is in place, not yet exercised.

## SDK generation

`scripts/generate-sdks.sh` runs `@openapitools/openapi-generator-cli` three times against `openapi.json`: `typescript-axios` → `sdks/typescript`, `csharp` → `sdks/dotnet`, `python` → `sdks/python`. All three verified to generate real, substantial client code from the real 245-path spec (excluded from `tsc`'s project scan via `tsconfig.json`'s new `exclude: ["node_modules", "dist", "sdks"]`, and from git via `.gitignore`).

## Cross-cutting request/response concerns

- **Correlation IDs** — `correlation-id.middleware.ts` assigns/propagates `x-correlation-id`, included in every structured error and log line.
- **Structured errors** — `all-exceptions.filter.ts`, a global `APP_FILTER`, normalizes every thrown exception (Nest's own, Prisma's, anything else) into `{error: {code, message, correlationId, details}}`.
- **Idempotency keys** — `idempotency.interceptor.ts` (global `APP_INTERCEPTOR`), backed by the `IdempotencyKey` table: a repeated request with the same `Idempotency-Key` header returns the original cached response instead of re-executing the handler. Uses `mergeMap` (not `tap`) specifically so the DB write marking the key complete is awaited *before* the response is emitted — see [phase5-decision-log.md](phase5-decision-log.md) for the real race condition this fixes.
- **Rate limiting** — `api-rate-limit.guard.ts`, Redis-backed sliding window (`RedisService.isWithinRateLimit`), fails open if Redis is unreachable (an outage in a non-source-of-truth cache shouldn't take down the API).
- **Health endpoints** — `health.controller.ts`: `/health` (composite), `/health/db`, `/health/redis`, `/health/dgx` — each a real dependency check, not a hardcoded 200.
- **Request logging** — `request-logging.middleware.ts`, using `redactSensitiveFields()` (`src/common/logging/redact.ts`) so passwords/tokens/secrets never reach a log line.
- **Metrics** — every request is timed and counted; see [production-observability.md](production-observability.md).

## Tests

`api-platform.integration-spec.ts` (4 tests), `all-exceptions.filter.spec.ts`, `correlation-id.middleware.spec.ts`.

## Known limitations

- No API gateway/edge proxy in front of this — rate limiting and auth happen in-process, appropriate for this build's scale, not yet load-balanced across instances.
- `openapi.json` and `sdks/` are generated artifacts, gitignored — regenerate via `scripts/generate-openapi.ts` and `scripts/generate-sdks.sh` rather than expecting them checked in.
- No formal API changelog/deprecation-notice mechanism yet beyond the versioning scaffold itself.
