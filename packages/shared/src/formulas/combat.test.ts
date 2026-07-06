import { describe, it, expect } from 'vitest';
import {
  resolveAttack,
  rollInitiative,
  fleeChance,
  mistResistance,
  effectiveAttributes,
} from './combat.js';

/** Deterministic RNG stub — returns the given values in order. */
function rngOf(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe('resolveAttack (GDD §13)', () => {
  const base = {
    attackScore: 22, // e.g. STR 8 × 2 + arme 6
    mitigation: 0,
    attackerDex: 0,
    defenderDex: 0,
  };

  it('applies the 0.9–1.1 variance bounds', () => {
    // rolls: dodge, crit, variance
    const min = resolveAttack(base, rngOf(0.99, 0.99, 0));
    const max = resolveAttack(base, rngOf(0.99, 0.99, 0.999999));
    expect(min.outcome).toBe('hit');
    expect(min.damage).toBe(Math.round(22 * 0.9));
    expect(max.damage).toBe(Math.round(22 * 1.1));
  });

  it('mitigates damage with armour: armor/(armor+50)', () => {
    // armour 50 → half damage; variance forced to 1.0 (roll 0.5)
    const result = resolveAttack({ ...base, mitigation: 50 }, rngOf(0.99, 0.99, 0.5));
    expect(result.damage).toBe(Math.round(22 * 0.5));
  });

  it('never drops below 1 damage on a hit', () => {
    const result = resolveAttack(
      { ...base, attackScore: 1, mitigation: 1000 },
      rngOf(0.99, 0.99, 0),
    );
    expect(result.damage).toBe(1);
  });

  it('crits at ×1.5 with chance DEX × 0.5 %', () => {
    // defender can't dodge; attacker DEX 10 → 5 % crit; crit roll 0.049 < 0.05
    const result = resolveAttack(
      { ...base, attackerDex: 10 },
      rngOf(0.99, 0.049, 0.5),
    );
    expect(result.outcome).toBe('crit');
    expect(result.damage).toBe(Math.round(22 * 1.5));
  });

  it('lets the defender dodge at DEX × 0.8 %', () => {
    // defender DEX 10 → 8 % dodge; dodge roll 0.079 < 0.08
    const result = resolveAttack({ ...base, defenderDex: 10 }, rngOf(0.079));
    expect(result.outcome).toBe('dodged');
    expect(result.damage).toBe(0);
  });

  it('applies a skill multiplier before variance', () => {
    const result = resolveAttack({ ...base, multiplier: 1.3 }, rngOf(0.99, 0.99, 0.5));
    expect(result.damage).toBe(Math.round(22 * 1.3));
  });
});

describe('rollInitiative', () => {
  it('adds DEX to a d10', () => {
    expect(rollInitiative(6, rngOf(0))).toBe(7); // d10 = 1
    expect(rollInitiative(6, rngOf(0.999999))).toBe(16); // d10 = 10
  });
});

describe('fleeChance', () => {
  it('is 50 % at equal DEX, ±3 % per point of difference', () => {
    expect(fleeChance(5, 5)).toBeCloseTo(0.5);
    expect(fleeChance(9, 5)).toBeCloseTo(0.62);
    expect(fleeChance(5, 9)).toBeCloseTo(0.38);
  });

  it('is clamped to 5–95 %', () => {
    expect(fleeChance(50, 0)).toBe(0.95);
    expect(fleeChance(0, 50)).toBe(0.05);
  });
});

describe('mistResistance', () => {
  it('is FER × 1 %', () => {
    expect(mistResistance(9)).toBeCloseTo(0.09);
  });
});

describe('effectiveAttributes (death penalty, GDD §2.4)', () => {
  const attrs = { str: 10, dex: 7, wil: 4, vit: 9, fer: 5 };

  it('returns attributes untouched without penalty', () => {
    expect(effectiveAttributes(attrs, false)).toEqual(attrs);
  });

  it('applies −20 % (floor) while the spark wavers', () => {
    expect(effectiveAttributes(attrs, true)).toEqual({
      str: 8,
      dex: 5,
      wil: 3,
      vit: 7,
      fer: 4,
    });
  });
});
