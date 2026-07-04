import { eq } from 'drizzle-orm';
import {
  CLASS_BASE_ATTRIBUTES,
  maxHp,
  xpForNextLevel,
  computeStamina,
  STAMINA_MAX,
  type CharacterClass,
  type CharacterDto,
  type RegenContext,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters, hexes } from '../../db/schema.js';
import { SPAWN_POI_TYPE } from '../../db/seed/world-data.js';
import { AppError } from '../../lib/app-error.js';

type CharacterRow = typeof characters.$inferSelect;
type HexRow = typeof hexes.$inferSelect;

export async function createCharacter(
  db: Db,
  userId: string,
  input: { name: string; class: CharacterClass },
  now: Date,
): Promise<CharacterDto> {
  const existing = await db.query.characters.findFirst({
    where: eq(characters.userId, userId),
  });
  if (existing) {
    throw new AppError('CHARACTER_EXISTS', 409);
  }

  const nameTaken = await db.query.characters.findFirst({
    where: eq(characters.name, input.name),
  });
  if (nameTaken) {
    throw new AppError('NAME_TAKEN', 409);
  }

  const spawn = await db.query.hexes.findFirst({
    where: eq(hexes.poiType, SPAWN_POI_TYPE),
  });
  if (!spawn) {
    throw new Error('Spawn hex missing — run db:seed');
  }

  const attributes = CLASS_BASE_ATTRIBUTES[input.class];

  const [row] = await db
    .insert(characters)
    .values({
      userId,
      name: input.name,
      class: input.class,
      ...attributes,
      hp: maxHp(attributes.vit),
      stamina: STAMINA_MAX,
      staminaUpdatedAt: now,
      hexId: spawn.id,
    })
    .returning();

  if (!row) throw new Error('Character insert returned no row');
  return toCharacterDto(row, spawn, now);
}

export async function getMyCharacter(
  db: Db,
  userId: string,
  now: Date,
): Promise<CharacterDto | null> {
  const row = await db.query.characters.findFirst({
    where: eq(characters.userId, userId),
  });
  if (!row) return null;

  const hex = await db.query.hexes.findFirst({ where: eq(hexes.id, row.hexId) });
  if (!hex) throw new Error(`Character ${row.id} references missing hex ${row.hexId}`);

  const { stamina, staminaUpdatedAt } = computeStamina(
    { stamina: row.stamina, staminaUpdatedAt: row.staminaUpdatedAt },
    now,
    regenContextFor(hex),
  );

  if (stamina !== row.stamina) {
    await db
      .update(characters)
      .set({ stamina, staminaUpdatedAt })
      .where(eq(characters.id, row.id));
  }

  return toCharacterDto({ ...row, stamina, staminaUpdatedAt }, hex, now);
}

export function regenContextFor(hex: Pick<HexRow, 'regionId' | 'terrain'>): RegenContext {
  if (hex.regionId === 0) return 'bastion';
  if (hex.terrain === 'shrine') return 'shrine';
  return 'field';
}

export function toCharacterDto(row: CharacterRow, hex: HexRow, now: Date): CharacterDto {
  const computed = computeStamina(
    { stamina: row.stamina, staminaUpdatedAt: row.staminaUpdatedAt },
    now,
    regenContextFor(hex),
  );
  return {
    id: row.id,
    name: row.name,
    class: row.class,
    level: row.level,
    xp: row.xp,
    xpNext: xpForNextLevel(row.level),
    attributes: { str: row.str, dex: row.dex, wil: row.wil, vit: row.vit, fer: row.fer },
    attributePoints: row.attributePoints,
    skillPoints: row.skillPoints,
    hp: row.hp,
    hpMax: maxHp(row.vit),
    stamina: computed.stamina,
    staminaMax: STAMINA_MAX,
    deathPenaltyUntil: row.deathPenaltyUntil?.toISOString() ?? null,
    hexId: row.hexId,
    regionId: hex.regionId,
    currencies: {
      ashCrowns: row.ashCrowns,
      emberFragments: row.emberFragments,
      gloryMarks: row.gloryMarks,
    },
  };
}
