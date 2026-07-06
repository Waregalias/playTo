/**
 * Mistborn of the Vellebrune Moors (GDD §14.3 lists them, stats set here —
 * SPEC-M2 décision 4). Foes are static content shared by API and web;
 * combats reference them by slug. Shadow sheep waits for the M4 raid.
 */
export interface LootEntry {
  itemId: string;
  /** Drop probability in [0, 1]. */
  chance: number;
  qtyMin: number;
  qtyMax: number;
}

export interface FoeSpec {
  slug: string;
  level: number;
  hpMax: number;
  /** Flat attack score (already includes its "weapon"). */
  attack: number;
  armor: number;
  resist: number;
  dex: number;
  xpReward: number;
  crownsMin: number;
  crownsMax: number;
  loot: LootEntry[];
}

export const FOES: Record<string, FoeSpec> = {
  'soot-wolf': {
    slug: 'soot-wolf',
    level: 2,
    hpMax: 34,
    attack: 11,
    armor: 4,
    resist: 2,
    dex: 7,
    xpReward: 25,
    crownsMin: 4,
    crownsMax: 9,
    loot: [
      { itemId: 'material.mistborn-hide', chance: 0.6, qtyMin: 1, qtyMax: 1 },
      { itemId: 'material.moor-herbs', chance: 0.25, qtyMin: 1, qtyMax: 1 },
    ],
  },
  'spectral-shepherd': {
    slug: 'spectral-shepherd',
    level: 3,
    hpMax: 46,
    attack: 13,
    armor: 6,
    resist: 8,
    dex: 5,
    xpReward: 40,
    crownsMin: 6,
    crownsMax: 12,
    loot: [
      { itemId: 'material.mistborn-hide', chance: 0.4, qtyMin: 1, qtyMax: 1 },
      { itemId: 'material.mist-essence', chance: 0.1, qtyMin: 1, qtyMax: 1 },
    ],
  },
  'heather-reaper': {
    slug: 'heather-reaper',
    level: 4,
    hpMax: 58,
    attack: 17,
    armor: 8,
    resist: 6,
    dex: 8,
    xpReward: 60,
    crownsMin: 9,
    crownsMax: 16,
    loot: [
      { itemId: 'material.moor-herbs', chance: 0.6, qtyMin: 1, qtyMax: 2 },
      { itemId: 'material.ash-glass', chance: 0.2, qtyMin: 1, qtyMax: 1 },
    ],
  },
  'hollow-knight': {
    slug: 'hollow-knight',
    level: 5,
    hpMax: 120,
    attack: 21,
    armor: 14,
    resist: 10,
    dex: 6,
    xpReward: 150,
    crownsMin: 30,
    crownsMax: 50,
    loot: [], // Q4 quest reward: the tier-2 class weapon
  },
};

/** Random-encounter pool for region 1 (Q4's Hollow Knight is quest-only). */
export const REGION_1_ENCOUNTER_POOL = ['soot-wolf', 'soot-wolf', 'spectral-shepherd', 'heather-reaper'];
