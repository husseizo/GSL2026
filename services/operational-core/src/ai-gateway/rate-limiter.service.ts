import { Injectable } from '@nestjs/common';

// In-memory sliding-window rate limiter, keyed by actor. A placeholder until
// real infrastructure (Redis, a gateway/proxy layer) exists — same scope
// limitation Phase 2/3 already documented for branch/warehouse RBAC scoping
// (rbac-permissions.md): correct behavior for a single process, not
// sufficient for a multi-instance deployment. `now` is an injectable
// parameter (not `Date.now()` internally) specifically so this is testable
// without real timers.
@Injectable()
export class RateLimiterService {
  private readonly windowMs = 60_000;
  private readonly maxRequestsPerWindow = 30;
  private readonly hits = new Map<string, number[]>();

  tryConsume(key: string, now: number = Date.now()): boolean {
    const existing = this.hits.get(key) ?? [];
    const withinWindow = existing.filter((t) => now - t < this.windowMs);

    if (withinWindow.length >= this.maxRequestsPerWindow) {
      this.hits.set(key, withinWindow);
      return false;
    }

    withinWindow.push(now);
    this.hits.set(key, withinWindow);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
