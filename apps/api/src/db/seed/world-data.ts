import type { Terrain } from '@aldenfer/shared';

export interface RegionSeed {
  id: number;
  slug: string;
  unlocked: boolean;
  mistLevel: number;
  emberLit: boolean;
}

export const REGION_SEEDS: RegionSeed[] = [
  { id: 0, slug: 'cinderlune', unlocked: true, mistLevel: 0, emberLit: true },
  { id: 1, slug: 'vellebrune-moors', unlocked: true, mistLevel: 2, emberLit: false },
  { id: 2, slug: 'shadeheart-wood', unlocked: false, mistLevel: 3, emberLit: false },
  { id: 3, slug: 'halvenn-quarries', unlocked: false, mistLevel: 3, emberLit: false },
];

export interface HexSeed {
  regionId: number;
  q: number;
  r: number;
  terrain: Terrain;
  poiType?: string;
}

/**
 * Single global axial grid so adjacency works across region borders.
 * Region 0 sits west of region 1; the West Gate (-1,2) touches the
 * ash road at (0,2). Region 1 layout extends the reference mockup
 * (23 hexes) to the 45 required by the GDD.
 */
export const HEX_SEEDS: HexSeed[] = [
  // ── Region 0 — Cinderlune Bastion (7 hexes, GDD §3.2)
  { regionId: 0, q: -2, r: 2, terrain: 'shrine', poiType: 'ember-hall' }, // spawn: Salle des Cendres
  { regionId: 0, q: -1, r: 2, terrain: 'ash_road', poiType: 'west-gate' },
  { regionId: 0, q: -3, r: 2, terrain: 'plain', poiType: 'market-square' },
  { regionId: 0, q: -2, r: 1, terrain: 'plain', poiType: 'chantry-hall' },
  { regionId: 0, q: -1, r: 1, terrain: 'plain', poiType: 'lantern-garden' },
  { regionId: 0, q: -2, r: 3, terrain: 'plain', poiType: 'brasfer-forge' },
  { regionId: 0, q: -3, r: 3, terrain: 'plain', poiType: 'archives' },

  // ── Region 1 — Vellebrune Moors (45 hexes)
  // Ash road spine from the West Gate
  { regionId: 1, q: 0, r: 2, terrain: 'ash_road' },
  { regionId: 1, q: 1, r: 2, terrain: 'ash_road' },
  { regionId: 1, q: 2, r: 2, terrain: 'shrine', poiType: 'old-ford-shrine' },
  // Heartland moors
  { regionId: 1, q: 3, r: 1, terrain: 'plain' },
  { regionId: 1, q: 3, r: 2, terrain: 'plain' },
  { regionId: 1, q: 2, r: 3, terrain: 'plain' },
  { regionId: 1, q: 2, r: 1, terrain: 'plain' },
  { regionId: 1, q: 1, r: 3, terrain: 'plain' },
  { regionId: 1, q: 4, r: 0, terrain: 'plain' },
  { regionId: 1, q: 0, r: 1, terrain: 'plain' },
  { regionId: 1, q: 1, r: 1, terrain: 'plain' },
  { regionId: 1, q: 0, r: 3, terrain: 'plain' },
  { regionId: 1, q: 0, r: 0, terrain: 'ash_road' },
  // Woods of the drowned hamlet
  { regionId: 1, q: 4, r: 1, terrain: 'forest' },
  { regionId: 1, q: 4, r: 2, terrain: 'forest', poiType: 'vellebrune-low-ruins' },
  { regionId: 1, q: 3, r: 0, terrain: 'forest' },
  { regionId: 1, q: 6, r: 2, terrain: 'forest' },
  // Sighing Marsh (south)
  { regionId: 1, q: 3, r: 3, terrain: 'marsh' },
  { regionId: 1, q: 4, r: 3, terrain: 'marsh', poiType: 'sighing-marsh' },
  { regionId: 1, q: 0, r: 4, terrain: 'marsh' },
  { regionId: 1, q: 1, r: 4, terrain: 'marsh' },
  { regionId: 1, q: 2, r: 4, terrain: 'marsh' },
  { regionId: 1, q: 3, r: 4, terrain: 'marsh' },
  { regionId: 1, q: 6, r: 3, terrain: 'marsh' },
  { regionId: 1, q: 4, r: 4, terrain: 'ford' }, // southern crossing
  { regionId: 1, q: 5, r: 4, terrain: 'ruins', poiType: 'drowned-hamlet' },
  { regionId: 1, q: 6, r: 4, terrain: 'plain' },
  // Northern hills
  { regionId: 1, q: 5, r: 0, terrain: 'hill' },
  { regionId: 1, q: 5, r: 1, terrain: 'hill' },
  { regionId: 1, q: 1, r: 0, terrain: 'hill' },
  { regionId: 1, q: 2, r: 0, terrain: 'hill' },
  { regionId: 1, q: 7, r: 0, terrain: 'hill' },
  { regionId: 1, q: 8, r: 0, terrain: 'hill' },
  // Eastern ruins & the Great Cairn
  { regionId: 1, q: 5, r: 2, terrain: 'ruins' },
  { regionId: 1, q: 6, r: 0, terrain: 'ruins' },
  { regionId: 1, q: 6, r: 1, terrain: 'plain' },
  { regionId: 1, q: 5, r: 3, terrain: 'plain' },
  { regionId: 1, q: 7, r: 1, terrain: 'shrine', poiType: 'great-cairn-ember' }, // regional Ember
  { regionId: 1, q: 7, r: 2, terrain: 'ruins', poiType: 'shepherd-cairns' },
  { regionId: 1, q: 7, r: 3, terrain: 'plain' },
  { regionId: 1, q: 8, r: 1, terrain: 'forest' },
  { regionId: 1, q: 8, r: 2, terrain: 'forest' },
  { regionId: 1, q: 8, r: 3, terrain: 'plain' },
  { regionId: 1, q: 9, r: 1, terrain: 'plain' },
  { regionId: 1, q: 9, r: 2, terrain: 'ford' }, // eastern crossing, towards region 2
];

/** poiType of the spawn hex (Salle des Cendres). */
export const SPAWN_POI_TYPE = 'ember-hall';
