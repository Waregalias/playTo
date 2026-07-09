import { and, eq } from 'drizzle-orm';
import {
  questGraphSchema,
  questProgressSchema,
  questRequiresSchema,
  type CharacterQuestDto,
  type Rng,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characterQuests, characters, hexes, quests } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { startCombat } from '../combat/service.js';
import { completeStep } from './hooks.js';

/** Active + available quests for the journal (API-SPEC §3). */
export async function listQuests(db: Db, characterId: string): Promise<CharacterQuestDto[]> {
  const [allQuests, mine, character] = await Promise.all([
    db.select().from(quests),
    db.select().from(characterQuests).where(eq(characterQuests.characterId, characterId)),
    db.query.characters.findFirst({ where: eq(characters.id, characterId) }),
  ]);
  const mineById = new Map(mine.map((cq) => [cq.questId, cq]));
  const doneIds = new Set(mine.filter((cq) => cq.state === 'done').map((cq) => cq.questId));

  const items: CharacterQuestDto[] = [];
  for (const quest of allQuests) {
    const cq = mineById.get(quest.id);
    if (cq) {
      if (cq.state === 'active' || cq.state === 'done') {
        items.push({
          questId: quest.id,
          state: cq.state,
          stepId: cq.stepId,
          progress: cq.progress ? questProgressSchema.parse(cq.progress) : null,
        });
      }
      continue;
    }
    const requires = quest.requires ? questRequiresSchema.parse(quest.requires) : {};
    const meets =
      (!requires.quest || doneIds.has(requires.quest)) &&
      (!requires.level || (character?.level ?? 0) >= requires.level);
    if (meets) {
      const graph = questGraphSchema.parse(quest.steps);
      items.push({ questId: quest.id, state: 'available', stepId: graph.start, progress: null });
    }
  }
  return items;
}

export async function acceptQuest(
  db: Db,
  characterId: string,
  questId: string,
): Promise<CharacterQuestDto> {
  return db.transaction(async (tx) => {
    const quest = await tx.query.quests.findFirst({ where: eq(quests.id, questId) });
    if (!quest) throw new AppError('NOT_FOUND', 404);

    const existing = await tx.query.characterQuests.findFirst({
      where: and(
        eq(characterQuests.characterId, characterId),
        eq(characterQuests.questId, questId),
      ),
    });
    if (existing) throw new AppError('REQUIREMENT_NOT_MET', 409);

    const requires = quest.requires ? questRequiresSchema.parse(quest.requires) : {};
    if (requires.quest) {
      const prior = await tx.query.characterQuests.findFirst({
        where: and(
          eq(characterQuests.characterId, characterId),
          eq(characterQuests.questId, requires.quest),
          eq(characterQuests.state, 'done'),
        ),
      });
      if (!prior) throw new AppError('REQUIREMENT_NOT_MET', 409);
    }
    const character = await tx.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });
    if (requires.level && (character?.level ?? 0) < requires.level) {
      throw new AppError('REQUIREMENT_NOT_MET', 409);
    }

    const graph = questGraphSchema.parse(quest.steps);
    await tx.insert(characterQuests).values({
      characterId,
      questId,
      state: 'active',
      stepId: graph.start,
      progress: { counts: {}, choices: {} },
    });
    return { questId, state: 'active', stepId: graph.start, progress: { counts: {}, choices: {} } };
  });
}

/** Resolves a choice step (Q3's branches). */
export async function advanceQuest(
  db: Db,
  characterId: string,
  questId: string,
  input: { stepId: string; choice?: string },
): Promise<CharacterQuestDto> {
  return db.transaction(async (tx) => {
    const [quest, cq] = await Promise.all([
      tx.query.quests.findFirst({ where: eq(quests.id, questId) }),
      tx.query.characterQuests.findFirst({
        where: and(
          eq(characterQuests.characterId, characterId),
          eq(characterQuests.questId, questId),
          eq(characterQuests.state, 'active'),
        ),
      }),
    ]);
    if (!quest || !cq) throw new AppError('NOT_FOUND', 404);
    if (cq.stepId !== input.stepId) throw new AppError('REQUIREMENT_NOT_MET', 409);

    const graph = questGraphSchema.parse(quest.steps);
    const step = graph.steps.find((s) => s.id === cq.stepId);
    if (!step || step.kind !== 'choice' || !input.choice) {
      throw new AppError('REQUIREMENT_NOT_MET', 409);
    }
    const option = step.options.find((o) => o.id === input.choice);
    if (!option) throw new AppError('REQUIREMENT_NOT_MET', 409);

    const progress = questProgressSchema.parse(cq.progress ?? { counts: {}, choices: {} });
    progress.choices[step.id] = option.id;

    await completeStep(
      tx,
      characterId,
      questId,
      graph,
      step,
      progress,
      option.next,
      option.extraRewards,
    );

    const updated = await tx.query.characterQuests.findFirst({
      where: and(
        eq(characterQuests.characterId, characterId),
        eq(characterQuests.questId, questId),
      ),
    });
    return {
      questId,
      state: updated!.state,
      stepId: updated!.stepId,
      progress: updated!.progress ? questProgressSchema.parse(updated!.progress) : null,
    };
  });
}

/** Launches a scripted quest fight (Q4's Hollow Knight). */
export async function startQuestCombat(
  db: Db,
  characterId: string,
  questId: string,
  now: Date,
  rng: Rng,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    if (!character) throw new AppError('NOT_FOUND', 404);

    const [quest, cq] = await Promise.all([
      tx.query.quests.findFirst({ where: eq(quests.id, questId) }),
      tx.query.characterQuests.findFirst({
        where: and(
          eq(characterQuests.characterId, characterId),
          eq(characterQuests.questId, questId),
          eq(characterQuests.state, 'active'),
        ),
      }),
    ]);
    if (!quest || !cq) throw new AppError('NOT_FOUND', 404);

    const graph = questGraphSchema.parse(quest.steps);
    const step = graph.steps.find((s) => s.id === cq.stepId);
    if (!step || step.kind !== 'combat') throw new AppError('REQUIREMENT_NOT_MET', 409);

    const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, character.hexId) });
    if (hex?.poiType !== step.atPoiType) throw new AppError('REQUIREMENT_NOT_MET', 409);

    return startCombat(tx, character, step.foeSlug, now, rng, questId);
  });
}
