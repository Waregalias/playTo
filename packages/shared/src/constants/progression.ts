/** XP required to go from `level` to `level + 1` (GDD §6). */
export function xpForNextLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.6));
}

export const LEVEL_CAP_SEASON_1 = 25;
