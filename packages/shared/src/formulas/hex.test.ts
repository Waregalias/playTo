import { describe, it, expect } from 'vitest';
import { hexesInRange, neighbours } from './hex.js';

describe('hexesInRange', () => {
  it('at radius 1 is the centre plus its six neighbours', () => {
    const center = { q: 3, r: -2 };
    const range = hexesInRange(center, 1);
    expect(range).toHaveLength(7);
    expect(range).toContainEqual(center);
    for (const n of neighbours(center)) {
      expect(range).toContainEqual(n);
    }
  });
  it('at radius 2 covers 19 hexes', () => {
    expect(hexesInRange({ q: 0, r: 0 }, 2)).toHaveLength(19);
  });
});
