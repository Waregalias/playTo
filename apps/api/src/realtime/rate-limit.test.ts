import { describe, it, expect } from 'vitest';
import { SlidingWindowRateLimiter } from './rate-limit.js';

describe('SlidingWindowRateLimiter', () => {
  it('allows up to the limit within the window, then blocks', () => {
    const rl = new SlidingWindowRateLimiter(3, 60_000);
    expect(rl.tryConsume('a', 1000)).toBe(true);
    expect(rl.tryConsume('a', 1000)).toBe(true);
    expect(rl.tryConsume('a', 1000)).toBe(true);
    expect(rl.tryConsume('a', 1000)).toBe(false);
  });

  it('tracks keys independently', () => {
    const rl = new SlidingWindowRateLimiter(1, 60_000);
    expect(rl.tryConsume('a', 1000)).toBe(true);
    expect(rl.tryConsume('b', 1000)).toBe(true);
    expect(rl.tryConsume('a', 1000)).toBe(false);
  });

  it('frees capacity once the window slides past old hits', () => {
    const rl = new SlidingWindowRateLimiter(2, 60_000);
    expect(rl.tryConsume('a', 1000)).toBe(true);
    expect(rl.tryConsume('a', 2000)).toBe(true);
    expect(rl.tryConsume('a', 3000)).toBe(false);
    expect(rl.tryConsume('a', 62_001)).toBe(true); // first two hits aged out
  });
});
