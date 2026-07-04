import {
  TERRAIN_SPECS,
  MIST_MULTIPLIERS,
  type Terrain,
  type MistLevel,
} from '../constants/terrains.js';

export interface MoveCost {
  stamina: number;
  durationSeconds: number;
}

/**
 * Cost to move onto a hex: terrain base × mist multiplier (GDD §3.1).
 * Stamina is rounded up (a step in the Mist is never cheaper than it looks);
 * duration is exact in seconds — every base duration × multiplier lands on
 * a whole second.
 */
export function moveCost(terrain: Terrain, mistLevel: MistLevel): MoveCost {
  const spec = TERRAIN_SPECS[terrain];
  const multiplier = MIST_MULTIPLIERS[mistLevel];
  return {
    stamina: Math.ceil(spec.staminaCost * multiplier),
    durationSeconds: Math.round(spec.moveMinutes * 60 * multiplier),
  };
}

/** Effective mist level of a hex: region level + local delta, clamped 0..3. */
export function effectiveMistLevel(regionMistLevel: number, mistDelta: number): MistLevel {
  return Math.min(3, Math.max(0, regionMistLevel + mistDelta)) as MistLevel;
}
