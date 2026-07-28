import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  it('allows requests under the limit', () => {
    const limiter = new RateLimiterService();
    for (let i = 0; i < 30; i++) {
      expect(limiter.tryConsume('actor-1', 1_000)).toBe(true);
    }
  });

  it('rejects the request once the per-window limit is exceeded', () => {
    const limiter = new RateLimiterService();
    for (let i = 0; i < 30; i++) {
      limiter.tryConsume('actor-1', 1_000);
    }
    expect(limiter.tryConsume('actor-1', 1_000)).toBe(false);
  });

  it('tracks separate actors independently', () => {
    const limiter = new RateLimiterService();
    for (let i = 0; i < 30; i++) {
      limiter.tryConsume('actor-1', 1_000);
    }
    expect(limiter.tryConsume('actor-1', 1_000)).toBe(false);
    expect(limiter.tryConsume('actor-2', 1_000)).toBe(true);
  });

  it('allows requests again once the window has slid past', () => {
    const limiter = new RateLimiterService();
    for (let i = 0; i < 30; i++) {
      limiter.tryConsume('actor-1', 1_000);
    }
    expect(limiter.tryConsume('actor-1', 1_000)).toBe(false);
    expect(limiter.tryConsume('actor-1', 1_000 + 60_001)).toBe(true);
  });

  it('reset() clears an actor immediately', () => {
    const limiter = new RateLimiterService();
    for (let i = 0; i < 30; i++) {
      limiter.tryConsume('actor-1', 1_000);
    }
    limiter.reset('actor-1');
    expect(limiter.tryConsume('actor-1', 1_000)).toBe(true);
  });
});
