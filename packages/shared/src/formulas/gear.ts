import { BROKEN_GEAR_PENALTY } from '../constants/combat.js';
import type { ItemStats } from '../schemas/inventory.js';

/**
 * Halves `power`/`armor` once durability has hit 0 (SPEC-M3 décision 2). Read-time only —
 * the base stats stored on the item are never mutated. Pure.
 */
export function deriveGearStats(
  stats: ItemStats,
  durability: number | null,
  maxDurability: number | null,
): ItemStats {
  if (durability !== 0 || maxDurability === null) return stats;
  return {
    ...stats,
    ...(stats.power !== undefined ? { power: Math.round(stats.power * BROKEN_GEAR_PENALTY) } : {}),
    ...(stats.armor !== undefined ? { armor: Math.round(stats.armor * BROKEN_GEAR_PENALTY) } : {}),
  };
}
