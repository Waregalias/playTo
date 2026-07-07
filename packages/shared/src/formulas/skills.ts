import type { CharacterClass } from '../constants/classes.js';
import { EMPTY_MODIFIERS, SKILLS_BY_ID, type SkillModifiers } from '../constants/skills.js';

/**
 * Aggregates the passive, M3-wired modifiers of the learned skills. Pure.
 * Numeric fields add; `contributionMult` multiplies (base 1); booleans OR.
 * Unknown ids and active skills are ignored.
 */
export function deriveSkillModifiers(learnedSkillIds: readonly string[]): SkillModifiers {
  const acc: SkillModifiers = { ...EMPTY_MODIFIERS };
  for (const id of learnedSkillIds) {
    const skill = SKILLS_BY_ID[id];
    if (!skill || skill.kind !== 'passive' || !skill.wiredInM3 || !skill.modifiers) continue;
    const m = skill.modifiers;
    if (m.armorPct) acc.armorPct += m.armorPct;
    if (m.dodgePct) acc.dodgePct += m.dodgePct;
    if (m.searchLootPct) acc.searchLootPct += m.searchLootPct;
    if (m.moveTimerPct) acc.moveTimerPct += m.moveTimerPct;
    if (m.visionBonus) acc.visionBonus += m.visionBonus;
    if (m.inventoryBonus) acc.inventoryBonus += m.inventoryBonus;
    if (m.deathMaterialLossPct) acc.deathMaterialLossPct += m.deathMaterialLossPct;
    if (m.foeAshCrownsPct) acc.foeAshCrownsPct += m.foeAshCrownsPct;
    if (m.firstTurnDmgPct) acc.firstTurnDmgPct += m.firstTurnDmgPct;
    if (m.contributionMult) acc.contributionMult *= m.contributionMult;
    if (m.blockFirstAttack) acc.blockFirstAttack = true;
    if (m.fleeNoPenalty) acc.fleeNoPenalty = true;
  }
  return acc;
}

export type SkillLearnErrorCode = 'SKILL_ALREADY_LEARNED' | 'REQUIREMENT_NOT_MET';
export interface SkillLearnResult {
  ok: boolean;
  code?: SkillLearnErrorCode;
}

/**
 * Whether `skillId` can be learned: own class, not already known, previous tier of the
 * same branch owned (tiers ≥2), a spare skill point, and enough ember fragments (tiers 4–5). Pure.
 */
export function skillLearnCheck(
  skillId: string,
  charClass: CharacterClass,
  learned: readonly string[],
  skillPoints: number,
  emberFragments: number,
): SkillLearnResult {
  const skill = SKILLS_BY_ID[skillId];
  if (!skill || skill.class !== charClass) return { ok: false, code: 'REQUIREMENT_NOT_MET' };
  if (learned.includes(skillId)) return { ok: false, code: 'SKILL_ALREADY_LEARNED' };
  if (skill.tier > 1 && !learned.includes(`${skill.class}.${skill.branch}.${skill.tier - 1}`)) {
    return { ok: false, code: 'REQUIREMENT_NOT_MET' };
  }
  if (skillPoints < 1 || emberFragments < skill.fragmentCost) {
    return { ok: false, code: 'REQUIREMENT_NOT_MET' };
  }
  return { ok: true };
}

/** Equippable in a combat slot = known, active, and wired this milestone. Pure. */
export function skillEquipCheck(skillId: string, learned: readonly string[]): boolean {
  const skill = SKILLS_BY_ID[skillId];
  return !!skill && learned.includes(skillId) && skill.kind === 'active' && skill.wiredInM3;
}
