import { describe, it, expect } from 'vitest';
import { deriveSkillModifiers, skillLearnCheck, skillEquipCheck } from './skills.js';

describe('deriveSkillModifiers', () => {
  it('returns identity for no skills', () => {
    const m = deriveSkillModifiers([]);
    expect(m.armorPct).toBe(0);
    expect(m.contributionMult).toBe(1);
    expect(m.blockFirstAttack).toBe(false);
  });

  it('adds numeric passive modifiers', () => {
    const m = deriveSkillModifiers(['blade.bulwark.1', 'blade.veteran.2']);
    expect(m.armorPct).toBe(10); // Garde ferme
    expect(m.inventoryBonus).toBe(10); // Porteur
  });

  it('multiplies contributionMult', () => {
    const m = deriveSkillModifiers(['cantor.ember.1']);
    expect(m.contributionMult).toBeCloseTo(1.4);
  });

  it('ignores unknown ids and active skills', () => {
    const m = deriveSkillModifiers(['does.not.exist', 'blade.steel.1']);
    expect(m.armorPct).toBe(0); // steel.1 is active → no passive modifier
  });

  it('sets deathMaterialLossPct from Poche double', () => {
    expect(deriveSkillModifiers(['scout.shadow.1']).deathMaterialLossPct).toBe(50);
  });

  it('sets boolean flags and stacks vision', () => {
    const m = deriveSkillModifiers(['scout.shadow.3', 'scout.travel.2', 'arcanist.scholar.2']);
    expect(m.fleeNoPenalty).toBe(true); // Évasion
    expect(m.visionBonus).toBe(2); // Longue-Vue + Cartographe
  });
});

describe('skillLearnCheck', () => {
  it('allows a tier-1 skill of the character class with a point', () => {
    expect(skillLearnCheck('blade.bulwark.1', 'blade', ['blade.steel.1'], 1, 0)).toEqual({
      ok: true,
    });
  });
  it('rejects a skill of another class', () => {
    expect(skillLearnCheck('arcanist.veil.1', 'blade', [], 5, 5)).toEqual({
      ok: false,
      code: 'REQUIREMENT_NOT_MET',
    });
  });
  it('rejects an already-known skill', () => {
    expect(skillLearnCheck('blade.steel.1', 'blade', ['blade.steel.1'], 1, 0)).toEqual({
      ok: false,
      code: 'SKILL_ALREADY_LEARNED',
    });
  });
  it('requires the previous tier of the same branch', () => {
    expect(skillLearnCheck('blade.bulwark.2', 'blade', [], 5, 0)).toEqual({
      ok: false,
      code: 'REQUIREMENT_NOT_MET',
    });
    expect(skillLearnCheck('blade.bulwark.2', 'blade', ['blade.bulwark.1'], 1, 0)).toEqual({
      ok: true,
    });
  });
  it('requires a skill point', () => {
    expect(skillLearnCheck('blade.bulwark.1', 'blade', [], 0, 0)).toEqual({
      ok: false,
      code: 'REQUIREMENT_NOT_MET',
    });
  });
  it('requires ember fragments for tiers 4–5', () => {
    const learned = ['blade.bulwark.1', 'blade.bulwark.2', 'blade.bulwark.3'];
    expect(skillLearnCheck('blade.bulwark.4', 'blade', learned, 1, 0)).toEqual({
      ok: false,
      code: 'REQUIREMENT_NOT_MET',
    });
    expect(skillLearnCheck('blade.bulwark.4', 'blade', learned, 1, 1)).toEqual({ ok: true });
  });
});

describe('skillEquipCheck', () => {
  it('accepts a learned, wired active', () => {
    expect(skillEquipCheck('blade.steel.1', ['blade.steel.1'])).toBe(true);
  });
  it('rejects a passive', () => {
    expect(skillEquipCheck('blade.bulwark.1', ['blade.bulwark.1'])).toBe(false);
  });
  it('rejects an inert (unwired) active', () => {
    expect(skillEquipCheck('arcanist.veil.1', ['arcanist.veil.1'])).toBe(false);
  });
  it('rejects an unlearned or unknown skill', () => {
    expect(skillEquipCheck('blade.steel.1', [])).toBe(false);
    expect(skillEquipCheck('does.not.exist', ['does.not.exist'])).toBe(false);
  });
});
