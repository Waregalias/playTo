export const TERRAINS = [
  'plain',
  'forest',
  'hill',
  'marsh',
  'ruins',
  'ash_road',
  'ford',
  'shrine',
] as const;

export type Terrain = (typeof TERRAINS)[number];

export interface TerrainSpec {
  /** Base stamina cost to move onto this terrain (GDD §3.1). */
  staminaCost: number;
  /** Base travel time in minutes (GDD §3.1). */
  moveMinutes: number;
}

export const TERRAIN_SPECS: Record<Terrain, TerrainSpec> = {
  ash_road: { staminaCost: 3, moveMinutes: 1 },
  plain: { staminaCost: 5, moveMinutes: 2 },
  forest: { staminaCost: 8, moveMinutes: 5 },
  hill: { staminaCost: 10, moveMinutes: 8 },
  marsh: { staminaCost: 12, moveMinutes: 10 },
  ruins: { staminaCost: 8, moveMinutes: 6 },
  ford: { staminaCost: 6, moveMinutes: 4 },
  shrine: { staminaCost: 5, moveMinutes: 2 },
};

/** Cost multiplier per mist level 0..3 (GDD §3.1). */
export const MIST_MULTIPLIERS = [1, 1.25, 1.5, 2] as const;

export type MistLevel = 0 | 1 | 2 | 3;
