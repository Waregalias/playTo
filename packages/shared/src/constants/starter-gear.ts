import type { CharacterClass } from './classes.js';

/**
 * Starting kit (SPEC-M2 décision 1): tier-1 class weapon equipped,
 * two ash potions, and the tier-1 offensive-branch skill in slot 1.
 * Free skill acquisition arrives with M3.
 */
export const STARTER_WEAPONS: Record<CharacterClass, string> = {
  blade: 'weapon.blade.t1',
  arcanist: 'weapon.arcanist.t1',
  scout: 'weapon.scout.t1',
  cantor: 'weapon.cantor.t1',
};

export const STARTER_POTIONS = { itemId: 'consumable.ash-potion', qty: 2 } as const;

export interface StarterSkillSpec {
  id: string;
  /** Damage multiplier applied to the class attack score. */
  multiplier: number;
  /** Cooldown in turns after use. */
  cooldown: number;
  kind: 'physical' | 'arcane';
}

export const STARTER_SKILLS: Record<CharacterClass, StarterSkillSpec> = {
  blade: { id: 'blade.steel.1', multiplier: 1.3, cooldown: 2, kind: 'physical' },
  arcanist: { id: 'arcanist.ashlight.1', multiplier: 1.3, cooldown: 2, kind: 'arcane' },
  scout: { id: 'scout.hunt.1', multiplier: 1.3, cooldown: 2, kind: 'physical' },
  cantor: { id: 'cantor.verse.2', multiplier: 1.3, cooldown: 2, kind: 'arcane' },
};
