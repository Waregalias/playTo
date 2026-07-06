import { xpForNextLevel, LEVEL_CAP_SEASON_1 } from '@aldenfer/shared';

export interface XpGain {
  level: number;
  xp: number;
  attributePoints: number;
  skillPoints: number;
  /** Set when at least one level was gained. */
  leveledTo?: number;
}

/**
 * Applies XP and cascades level-ups (GDD §6): +2 attribute points per
 * level, +1 skill point on even levels, season cap 25.
 */
export function applyXp(
  current: { level: number; xp: number; attributePoints: number; skillPoints: number },
  gained: number,
): XpGain {
  let { level, xp, attributePoints, skillPoints } = current;
  xp += gained;
  let leveledTo: number | undefined;

  while (level < LEVEL_CAP_SEASON_1 && xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    attributePoints += 2;
    if (level % 2 === 0) skillPoints += 1;
    leveledTo = level;
  }

  return { level, xp, attributePoints, skillPoints, leveledTo };
}
