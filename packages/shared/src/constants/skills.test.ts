import { describe, it, expect } from 'vitest';
import { CHARACTER_CLASSES, type CharacterClass } from './classes.js';
import { SKILLS, SKILLS_BY_ID, getSkill, EMPTY_MODIFIERS } from './skills.js';

const BRANCHES: Record<CharacterClass, [string, string, string]> = {
  blade: ['bulwark', 'steel', 'veteran'],
  arcanist: ['ashlight', 'veil', 'scholar'],
  scout: ['hunt', 'travel', 'shadow'],
  cantor: ['hymn', 'ember', 'verse'],
};

describe('skill catalog', () => {
  it('has exactly 60 skills: 4 classes × 3 branches × 5 tiers', () => {
    expect(SKILLS).toHaveLength(60);
  });

  it('covers every class/branch/tier once with a well-formed id', () => {
    for (const cls of CHARACTER_CLASSES) {
      for (const branch of BRANCHES[cls]) {
        for (let tier = 1; tier <= 5; tier++) {
          const id = `${cls}.${branch}.${tier}`;
          const skill = getSkill(id);
          expect(skill, id).toBeDefined();
          expect(skill!.class).toBe(cls);
          expect(skill!.branch).toBe(branch);
          expect(skill!.tier).toBe(tier);
        }
      }
    }
  });

  it('indexes every skill by id', () => {
    expect(Object.keys(SKILLS_BY_ID)).toHaveLength(60);
    for (const s of SKILLS) expect(SKILLS_BY_ID[s.id]).toBe(s);
  });

  it('charges ember fragments only on tiers 4–5', () => {
    for (const s of SKILLS) {
      if (s.tier <= 3) expect(s.fragmentCost, s.id).toBe(0);
      else expect(s.fragmentCost, s.id).toBeGreaterThan(0);
    }
  });

  it('gives every active skill combat params and no passive one', () => {
    for (const s of SKILLS) {
      if (s.kind === 'active') expect(s.active, s.id).toBeDefined();
      else expect(s.active, s.id).toBeUndefined();
    }
  });

  it('exposes an identity modifier set', () => {
    expect(EMPTY_MODIFIERS.contributionMult).toBe(1);
    expect(EMPTY_MODIFIERS.armorPct).toBe(0);
    expect(EMPTY_MODIFIERS.blockFirstAttack).toBe(false);
  });

  it('keeps the M2 starter skills present as tier-1 actives', () => {
    for (const id of ['blade.steel.1', 'arcanist.ashlight.1', 'scout.hunt.1', 'cantor.verse.2']) {
      expect(getSkill(id)?.kind, id).toBe('active');
    }
  });
});
