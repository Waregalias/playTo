import { itemStatsSchema, type ItemStats } from '@aldenfer/shared';

export interface ItemSeed {
  id: string;
  kind: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest';
  rarity: 'common' | 'rare' | 'ember' | 'relic';
  stats?: ItemStats;
  stackable: boolean;
}

const weapons: ItemSeed[] = [
  // Tier 1 — starter kit
  { id: 'weapon.blade.t1', kind: 'weapon', rarity: 'common', stackable: false, stats: { power: 6, damageKind: 'physical', classRestriction: 'blade' } },
  { id: 'weapon.arcanist.t1', kind: 'weapon', rarity: 'common', stackable: false, stats: { power: 6, damageKind: 'arcane', classRestriction: 'arcanist' } },
  { id: 'weapon.scout.t1', kind: 'weapon', rarity: 'common', stackable: false, stats: { power: 6, damageKind: 'physical', classRestriction: 'scout' } },
  { id: 'weapon.cantor.t1', kind: 'weapon', rarity: 'common', stackable: false, stats: { power: 6, damageKind: 'arcane', classRestriction: 'cantor' } },
  // Tier 2 — Q4 reward
  { id: 'weapon.blade.t2', kind: 'weapon', rarity: 'rare', stackable: false, stats: { power: 10, damageKind: 'physical', classRestriction: 'blade' } },
  { id: 'weapon.arcanist.t2', kind: 'weapon', rarity: 'rare', stackable: false, stats: { power: 10, damageKind: 'arcane', classRestriction: 'arcanist' } },
  { id: 'weapon.scout.t2', kind: 'weapon', rarity: 'rare', stackable: false, stats: { power: 10, damageKind: 'physical', classRestriction: 'scout' } },
  { id: 'weapon.cantor.t2', kind: 'weapon', rarity: 'rare', stackable: false, stats: { power: 10, damageKind: 'arcane', classRestriction: 'cantor' } },
];

const armors: ItemSeed[] = [
  { id: 'armor.leather.t1', kind: 'armor', rarity: 'common', stackable: false, stats: { armor: 4 } },
  { id: 'armor.chain.t1', kind: 'armor', rarity: 'common', stackable: false, stats: { armor: 7 } },
];

const consumables: ItemSeed[] = [
  { id: 'consumable.ash-potion', kind: 'consumable', rarity: 'common', stackable: true, stats: { heal: 30 } },
];

const materials: ItemSeed[] = [
  { id: 'material.shadewood', kind: 'material', rarity: 'common', stackable: true },
  { id: 'material.soot-ore', kind: 'material', rarity: 'common', stackable: true },
  { id: 'material.moor-herbs', kind: 'material', rarity: 'common', stackable: true },
  { id: 'material.mistborn-hide', kind: 'material', rarity: 'common', stackable: true },
  { id: 'material.ash-glass', kind: 'material', rarity: 'common', stackable: true },
  { id: 'material.mist-essence', kind: 'material', rarity: 'rare', stackable: true },
];

export const ITEM_SEEDS: ItemSeed[] = [...weapons, ...armors, ...consumables, ...materials].map(
  (item) => ({
    ...item,
    stats: item.stats ? itemStatsSchema.parse(item.stats) : undefined,
  }),
);
