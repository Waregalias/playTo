import { describe, it, expect } from 'vitest';
import { moveCost, effectiveMistLevel } from './movement.js';
import { isAdjacent, neighbours } from './hex.js';

describe('moveCost', () => {
  it('returns base costs at mist level 0', () => {
    expect(moveCost('plain', 0)).toEqual({ stamina: 5, durationSeconds: 120 });
    expect(moveCost('ash_road', 0)).toEqual({ stamina: 3, durationSeconds: 60 });
  });

  it('covers the ford terrain (GDD §3.1)', () => {
    expect(moveCost('ford', 0)).toEqual({ stamina: 6, durationSeconds: 240 });
    expect(moveCost('ford', 2)).toEqual({ stamina: 9, durationSeconds: 360 });
  });

  it('doubles all costs at mist level 3', () => {
    expect(moveCost('marsh', 3)).toEqual({ stamina: 24, durationSeconds: 1200 });
  });

  it('rounds stamina up on fractional multipliers (×1.25)', () => {
    // plain: 5 × 1.25 = 6.25 → 7 ; 2 min × 1.25 = 150 s exact
    expect(moveCost('plain', 1)).toEqual({ stamina: 7, durationSeconds: 150 });
  });

  it('applies ×1.5 at mist level 2', () => {
    expect(moveCost('forest', 2)).toEqual({ stamina: 12, durationSeconds: 450 });
  });
});

describe('effectiveMistLevel', () => {
  it('adds the local delta and clamps to 0..3', () => {
    expect(effectiveMistLevel(2, 0)).toBe(2);
    expect(effectiveMistLevel(2, 2)).toBe(3);
    expect(effectiveMistLevel(1, -3)).toBe(0);
  });
});

describe('hex adjacency (axial)', () => {
  it('recognises the six neighbours', () => {
    const origin = { q: 3, r: 2 };
    for (const n of neighbours(origin)) {
      expect(isAdjacent(origin, n)).toBe(true);
    }
  });

  it('rejects self, diagonals and distant hexes', () => {
    expect(isAdjacent({ q: 3, r: 2 }, { q: 3, r: 2 })).toBe(false);
    expect(isAdjacent({ q: 3, r: 2 }, { q: 4, r: 3 })).toBe(false);
    expect(isAdjacent({ q: 3, r: 2 }, { q: 5, r: 2 })).toBe(false);
  });
});
