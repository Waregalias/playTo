import type { LootEntry } from './foes.js';

/** Search action costs (GDD §8). */
export const SEARCH_ACTION = {
  staminaCost: 10,
  durationMinutes: 5,
  xpReward: 15,
} as const;

/**
 * Loot tables per searchable POI (region ≥ 1 only — bastion POIs are
 * services, not dig sites). Balance in beta.
 */
export const POI_LOOT: Record<string, LootEntry[]> = {
  'old-ford-shrine': [
    { itemId: 'material.moor-herbs', chance: 0.5, qtyMin: 1, qtyMax: 2 },
    { itemId: 'material.ash-glass', chance: 0.15, qtyMin: 1, qtyMax: 1 },
  ],
  'vellebrune-low-ruins': [
    { itemId: 'material.shadewood', chance: 0.6, qtyMin: 1, qtyMax: 2 },
    { itemId: 'material.soot-ore', chance: 0.4, qtyMin: 1, qtyMax: 1 },
    { itemId: 'consumable.ash-potion', chance: 0.15, qtyMin: 1, qtyMax: 1 },
  ],
  'sighing-marsh': [
    { itemId: 'material.moor-herbs', chance: 0.7, qtyMin: 1, qtyMax: 2 },
    { itemId: 'material.mist-essence', chance: 0.08, qtyMin: 1, qtyMax: 1 },
  ],
  'shepherd-cairns': [
    { itemId: 'material.mistborn-hide', chance: 0.5, qtyMin: 1, qtyMax: 1 },
    { itemId: 'material.moor-herbs', chance: 0.4, qtyMin: 1, qtyMax: 1 },
  ],
  'drowned-hamlet': [
    { itemId: 'material.shadewood', chance: 0.6, qtyMin: 1, qtyMax: 2 },
    { itemId: 'material.ash-glass', chance: 0.25, qtyMin: 1, qtyMax: 1 },
  ],
  'great-cairn-ember': [
    { itemId: 'material.ash-glass', chance: 0.4, qtyMin: 1, qtyMax: 1 },
    { itemId: 'material.mist-essence', chance: 0.12, qtyMin: 1, qtyMax: 1 },
  ],
};

/** Base inventory capacity: 30 + STR slots (GDD §9.2). */
export const INVENTORY_BASE_CAPACITY = 30;
