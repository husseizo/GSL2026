import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getRequestActor } from '../common/permissions/request-actor';
import { RedisService } from '../redis/redis.service';

const MAX_REQUESTS_PER_WINDOW = 300;
const WINDOW_SECONDS = 60;

// General-purpose, distributed (Redis-backed) API rate limiting — distinct
// from AiGatewayService's dedicated in-memory limiter (which stays exactly
// as Phase 4 built it, scoped to AI inference calls specifically). This one
// covers every endpoint, registered as a global guard so no existing
// controller needed a decorator added. Generous default (300 req/min per
// actor) so it never interferes with the verification scripts' normal
// traffic — its job is to stop runaway/abusive traffic, not to throttle
// legitimate use. See docs/architecture/api-platform.md.
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const actor = getRequestActor(request);
    const key = actor.userId ?? request.ip ?? 'anonymous';

    try {
      const withinLimit = await this.redis.isWithinRateLimit(`api:${key}`, MAX_REQUESTS_PER_WINDOW, WINDOW_SECONDS);
      if (!withinLimit) {
        throw new HttpException('Rate limit exceeded — too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Redis unreachable: fail OPEN, not closed — "the platform must
      // continue operating even if ... one integration fails" applies to
      // Redis too. A rate limiter that takes down the whole API when its
      // backing store is unavailable would be worse than no rate limiting.
      return true;
    }
  }
}
