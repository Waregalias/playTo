import { describe, it, expect } from 'vitest';
import { computeStamina } from './stamina.js';

const at = (iso: string) => new Date(iso);

describe('computeStamina', () => {
  it('regenerates 1 point per 6 minutes in the field', () => {
    const result = computeStamina(
      { stamina: 50, staminaUpdatedAt: at('2026-01-01T00:00:00Z') },
      at('2026-01-01T01:00:00Z'),
    );
    expect(result.stamina).toBe(60);
  });

  it('keeps the fractional remainder by advancing updatedAt only by whole intervals', () => {
    const result = computeStamina(
      { stamina: 50, staminaUpdatedAt: at('2026-01-01T00:00:00Z') },
      at('2026-01-01T00:08:00Z'), // 8 min → 1 point + 2 min de reste
    );
    expect(result.stamina).toBe(51);
    expect(result.staminaUpdatedAt).toEqual(at('2026-01-01T00:06:00Z'));
  });

  it('caps at 100 and anchors updatedAt to now once full', () => {
    const now = at('2026-01-02T00:00:00Z');
    const result = computeStamina(
      { stamina: 95, staminaUpdatedAt: at('2026-01-01T00:00:00Z') },
      now,
    );
    expect(result.stamina).toBe(100);
    expect(result.staminaUpdatedAt).toEqual(now);
  });

  it('regenerates twice as fast in the bastion (region 0)', () => {
    const result = computeStamina(
      { stamina: 50, staminaUpdatedAt: at('2026-01-01T00:00:00Z') },
      at('2026-01-01T01:00:00Z'),
      'bastion',
    );
    expect(result.stamina).toBe(70);
  });

  it('regenerates ×1.5 on a shrine hex', () => {
    const result = computeStamina(
      { stamina: 50, staminaUpdatedAt: at('2026-01-01T00:00:00Z') },
      at('2026-01-01T01:00:00Z'),
      'shrine',
    );
    expect(result.stamina).toBe(65);
  });

  it('never regenerates backwards when now precedes updatedAt', () => {
    const result = computeStamina(
      { stamina: 50, staminaUpdatedAt: at('2026-01-01T01:00:00Z') },
      at('2026-01-01T00:00:00Z'),
    );
    expect(result.stamina).toBe(50);
    expect(result.staminaUpdatedAt).toEqual(at('2026-01-01T01:00:00Z'));
  });

  it('returns zero gain when no full interval has elapsed', () => {
    const before = at('2026-01-01T00:00:00Z');
    const result = computeStamina(
      { stamina: 50, staminaUpdatedAt: before },
      at('2026-01-01T00:05:59Z'),
    );
    expect(result.stamina).toBe(50);
    expect(result.staminaUpdatedAt).toEqual(before);
  });
});
