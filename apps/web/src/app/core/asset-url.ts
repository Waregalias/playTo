/**
 * Resolve game identifiers to bundled asset paths under /assets.
 * Returns null when no art was provided so callers can fall back to the
 * existing rune-letter / glyph rendering. Alias tables cover the naming
 * mismatches between game ids and delivered file names.
 */

// Item files that exist on disk (public/assets/items/<cat>/<file>.png).
const ITEM_FILES: ReadonlySet<string> = new Set([
  // weapons
  'weapon.arcanist.t1', 'weapon.arcanist.t2',
  'weapon.cantor.t1', 'weapon.cantor.t2', 'weapon.cantor.t3',
  'weapon.lame.t1', 'weapon.lame.t2', 'weapon.lame.t3', 'weapon.lame.t5',
  'weapon.scoot.t1', 'weapon.scoot.t2',
  // armors
  'armor.boots.t1', 'armor.boots.t2', 'armor.bracer.t1',
  'armor.helmet.t1', 'armor.helmet.t2', 'armor.helmet.t3', 'armor.helmet.t4',
  'armor.leather.t1', 'armor.leather.t2', 'armor.shield.t1', 'armor.shield.t2',
  // consumables
  'consumable.ash-potioni', 'consumable.dungeon-key', 'consumable.roast-chicken',
  // materials
  'material.ash-glass', 'material.cloth', 'material.coins', 'material.crystal-ore',
  'material.feather', 'material.lavenders', 'material.mist-essence', 'material.mistborn-hide',
  'material.moor-herbs', 'material.ore', 'material.parchment', 'material.reptile-hide',
  'material.shadewood', 'material.soot-ore', 'material.stone', 'material.wood',
]);

const ITEM_CATEGORY: Record<string, string> = {
  weapon: 'weapons',
  armor: 'armors',
  consumable: 'consumables',
  material: 'materials',
};

// Game id fragment -> delivered file fragment.
const ITEM_ALIASES: Record<string, string> = {
  'weapon.blade': 'weapon.lame',
  'weapon.scout': 'weapon.scoot',
  'consumable.ash-potion': 'consumable.ash-potioni',
};

export function itemIconUrl(itemId: string): string | null {
  const category = ITEM_CATEGORY[itemId.split('.')[0] ?? ''];
  if (!category) return null;
  let file = itemId;
  for (const [from, to] of Object.entries(ITEM_ALIASES)) {
    if (file === from || file.startsWith(`${from}.`)) {
      file = file.replace(from, to);
      break;
    }
  }
  return ITEM_FILES.has(file) ? `/assets/items/${category}/${file}.png` : null;
}

// Provided skill icons keyed by game skill id (only scout hunt branch shipped).
const SKILL_FILES: Record<string, string> = {
  'scout.hunt.1': 'skill.precise-shot',
  'scout.hunt.3': 'skill.double-shot',
  'scout.hunt.5': 'skill.latern-arrow',
  // skill.tracking.png reserved for the passive Traque line if wired later.
};

export function skillIconUrl(skillId: string): string | null {
  const file = SKILL_FILES[skillId];
  return file ? `/assets/skills/${file}.png` : null;
}

const TERRAIN_FILES: Record<string, string> = {
  plain: 'plain', forest: 'forest', hill: 'hill', marsh: 'marsh',
  ruins: 'ruins', ford: 'ford', shrine: 'altar',
  // ash_road: no vignette shipped.
};

export function terrainVignetteUrl(terrain: string): string | null {
  const file = TERRAIN_FILES[terrain];
  return file ? `/assets/lands/${file}.png` : null;
}

const HERO_FULL_FILES: Record<string, string> = {
  blade: 'blade_full', arcanist: 'arcanist_full', scout: 'scoot_full', cantor: 'cantor_full',
};

export function heroFullUrl(klass: string): string | null {
  const file = HERO_FULL_FILES[klass];
  return file ? `/assets/heroes/${file}.png` : null;
}

const HERO_PORTRAIT_FILES: Record<string, string> = {
  blade: 'blade', arcanist: 'arcanist', scout: 'scout', cantor: 'cantor',
};

export function heroPortraitUrl(klass: string): string | null {
  const file = HERO_PORTRAIT_FILES[klass];
  return file ? `/assets/heroes/${file}.png` : null;
}
