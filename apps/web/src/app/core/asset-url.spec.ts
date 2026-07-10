import { heroFullUrl, itemIconUrl, skillIconUrl, terrainVignetteUrl } from './asset-url';

describe('asset-url', () => {
  it('maps a material id to its icon', () => {
    expect(itemIconUrl('material.shadewood')).toBe('/assets/items/materials/material.shadewood.png');
  });

  it('aliases blade weapons to the "lame" art files', () => {
    expect(itemIconUrl('weapon.blade.t1')).toBe('/assets/items/weapons/weapon.lame.t1.png');
  });

  it('aliases scout weapons to the "scoot" art files', () => {
    expect(itemIconUrl('weapon.scout.t1')).toBe('/assets/items/weapons/weapon.scoot.t1.png');
  });

  it('aliases the ash-potion typo file', () => {
    expect(itemIconUrl('consumable.ash-potion')).toBe('/assets/items/consumables/consumable.ash-potioni.png');
  });

  it('returns null for items without provided art (chain armour)', () => {
    expect(itemIconUrl('armor.chain.t1')).toBeNull();
  });

  it('maps the provided scout hunt skills, null otherwise', () => {
    expect(skillIconUrl('scout.hunt.1')).toBe('/assets/skills/skill.precise-shot.png');
    expect(skillIconUrl('scout.hunt.3')).toBe('/assets/skills/skill.double-shot.png');
    expect(skillIconUrl('scout.hunt.5')).toBe('/assets/skills/skill.latern-arrow.png');
    expect(skillIconUrl('blade.steel.1')).toBeNull();
  });

  it('maps terrains including shrine->altar, null for ash_road', () => {
    expect(terrainVignetteUrl('plain')).toBe('/assets/lands/plain.png');
    expect(terrainVignetteUrl('shrine')).toBe('/assets/lands/altar.png');
    expect(terrainVignetteUrl('ash_road')).toBeNull();
  });

  it('maps hero full-body art including scout->scoot', () => {
    expect(heroFullUrl('blade')).toBe('/assets/heroes/blade_full.png');
    expect(heroFullUrl('scout')).toBe('/assets/heroes/scoot_full.png');
  });
});
