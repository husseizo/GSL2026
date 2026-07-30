import { SetMetadata } from '@nestjs/common';

export const REQUIRE_VERIFIED_ACTOR_KEY = 'requireVerifiedActor';

// Marks a handler as requiring a cryptographically-verified actor (a real
// Bearer JWT or x-api-key, resolved by the global JwtAuthContextGuard) —
// never the legacy x-user-role header stand-in. Additive and opt-in: a
// handler without this decorator is entirely unaffected by it; PermissionsGuard
// still evaluates role/permission exactly as before for every other handler.
// See docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
// §4 (PRTS-002).
export const RequireVerifiedActor = () => SetMetadata(REQUIRE_VERIFIED_ACTOR_KEY, true);
