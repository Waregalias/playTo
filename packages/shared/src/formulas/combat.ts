import { COMBAT, DEATH_PENALTY } from '../constants/combat.js';
import type { BaseAttributes } from '../constants/classes.js';

/** Server-side randomness source, injected everywhere (ARCHITECTURE §4.4). */
export type Rng = () => number;

export interface AttackInput {
  /** STR × 2 + weapon (physical) or WIL × 2 + focus (arcane), or foe attack. */
  attackScore: number;
  /** Defender armour (physical) or resist (arcane). */
  mitigation: number;
  attackerDex: number;
  defenderDex: number;
  /** Skill multiplier (e.g. ×1.3), defaults to 1. */
  multiplier?: number;
}

export interface AttackResult {
  outcome: 'hit' | 'crit' | 'dodged';
  damage: number;
}

/**
 * One attack, GDD §13. Roll order is fixed and journaled: dodge, crit,
 * variance — so a combat log fully replays the fight.
 */
export function resolveAttack(input: AttackInput, rng: Rng): AttackResult {
  if (rng() < input.defenderDex * COMBAT.dodgePerDex) {
    return { outcome: 'dodged', damage: 0 };
  }

  const crit = rng() < input.attackerDex * COMBAT.critPerDex;
  const variance = COMBAT.varianceMin + rng() * COMBAT.varianceSpan;
  const mitigated = 1 - input.mitigation / (input.mitigation + COMBAT.mitigationScale);

  const raw =
    input.attackScore *
    (input.multiplier ?? 1) *
    mitigated *
    variance *
    (crit ? COMBAT.critMultiplier : 1);

  return { outcome: crit ? 'crit' : 'hit', damage: Math.max(1, Math.round(raw)) };
}

/** Initiative = DEX + d10 (GDD §13). */
export function rollInitiative(dex: number, rng: Rng): number {
  return dex + 1 + Math.floor(rng() * 10);
}

/** Flee = 50 % + (player DEX − foe DEX) × 3 %, clamped to 5–95 %. */
export function fleeChance(playerDex: number, foeDex: number): number {
  const chance = COMBAT.fleeBase + (playerDex - foeDex) * COMBAT.fleePerDexDiff;
  return Math.min(COMBAT.fleeMax, Math.max(COMBAT.fleeMin, chance));
}

/** Mist resistance = FER × 1 % (reduces level 2+ mist maluses). */
export function mistResistance(fer: number): number {
  return fer * COMBAT.mistResistPerFer;
}

/** Attributes while the spark wavers: −20 %, floored (GDD §2.4). */
export function effectiveAttributes(
  attrs: BaseAttributes,
  deathPenaltyActive: boolean,
): BaseAttributes {
  if (!deathPenaltyActive) return attrs;
  const m = DEATH_PENALTY.statMultiplier;
  return {
    str: Math.floor(attrs.str * m),
    dex: Math.floor(attrs.dex * m),
    wil: Math.floor(attrs.wil * m),
    vit: Math.floor(attrs.vit * m),
    fer: Math.floor(attrs.fer * m),
  };
}
