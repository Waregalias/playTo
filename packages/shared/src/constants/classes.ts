export const CHARACTER_CLASSES = ['blade', 'arcanist', 'scout', 'cantor'] as const;

export type CharacterClass = (typeof CHARACTER_CLASSES)[number];

export interface BaseAttributes {
  str: number;
  dex: number;
  wil: number;
  vit: number;
  fer: number;
}

/** Starting attributes per class (GDD §4). */
export const CLASS_BASE_ATTRIBUTES: Record<CharacterClass, BaseAttributes> = {
  blade: { str: 8, dex: 5, wil: 4, vit: 9, fer: 4 },
  arcanist: { str: 3, dex: 5, wil: 9, vit: 5, fer: 8 },
  scout: { str: 5, dex: 9, wil: 5, vit: 6, fer: 5 },
  cantor: { str: 4, dex: 4, wil: 7, vit: 6, fer: 9 },
};

/** Max HP from vitality (GDD §13). */
export function maxHp(vit: number): number {
  return 30 + vit * 8;
}
