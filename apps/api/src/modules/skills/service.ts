import { eq } from 'drizzle-orm';
import {
  SKILLS_BY_ID,
  skillEquipCheck,
  skillLearnCheck,
  type CharacterDto,
  type EquipSkillsInput,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters, hexes } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { toCharacterDto } from '../characters/service.js';

type CharacterRow = typeof characters.$inferSelect;

async function characterDto(db: Db, row: CharacterRow, now: Date): Promise<CharacterDto> {
  const hex = (await db.query.hexes.findFirst({ where: eq(hexes.id, row.hexId) }))!;
  return toCharacterDto(row, hex, now);
}

export async function learnSkill(
  db: Db,
  character: CharacterRow,
  skillId: string,
  now: Date,
): Promise<CharacterDto> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, character.id))
      .for('update');
    if (!row) throw new AppError('NOT_FOUND', 404);

    const check = skillLearnCheck(
      skillId,
      row.class,
      row.learnedSkills,
      row.skillPoints,
      row.emberFragments,
    );
    if (!check.ok) throw new AppError(check.code!, 409);

    const skill = SKILLS_BY_ID[skillId]!;
    const [updated] = await tx
      .update(characters)
      .set({
        skillPoints: row.skillPoints - 1,
        emberFragments: row.emberFragments - skill.fragmentCost,
        learnedSkills: [...row.learnedSkills, skillId],
      })
      .where(eq(characters.id, character.id))
      .returning();
    return characterDto(db, updated!, now);
  });
}

export async function equipSkills(
  db: Db,
  character: CharacterRow,
  input: EquipSkillsInput,
  now: Date,
): Promise<CharacterDto> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, character.id))
      .for('update');
    if (!row) throw new AppError('NOT_FOUND', 404);

    // The payload is the full desired state: an absent or null slot clears it.
    const slot1 = input.slot1 ?? undefined;
    const slot2 = input.slot2 ?? undefined;
    for (const value of [slot1, slot2]) {
      if (value && !skillEquipCheck(value, row.learnedSkills)) {
        throw new AppError('REQUIREMENT_NOT_MET', 409);
      }
    }
    if (slot1 && slot2 && slot1 === slot2) throw new AppError('REQUIREMENT_NOT_MET', 409);

    const equippedSkills = {
      ...(slot1 ? { slot1 } : {}),
      ...(slot2 ? { slot2 } : {}),
    };
    const [updated] = await tx
      .update(characters)
      .set({ equippedSkills })
      .where(eq(characters.id, character.id))
      .returning();
    return characterDto(db, updated!, now);
  });
}
