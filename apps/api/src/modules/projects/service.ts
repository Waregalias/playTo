import { and, eq, sql } from 'drizzle-orm';
import {
  planContribution,
  contributionReward,
  deriveSkillModifiers,
  CONTRIBUTION_STAMINA_COST,
  RESOURCE_ITEM_IDS,
  computeStamina,
  questGraphSchema,
  questProgressSchema,
  type ProjectDto,
  type ProjectDetailDto,
  type CharacterDto,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters, contributions, hexes, projects, characterQuests, quests } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { applyXp } from '../../lib/progression.js';
import { removeMaterialQty } from '../inventory/service.js';
import { regenContextFor, toCharacterDto } from '../characters/service.js';
import { completeStep } from '../quests/hooks.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type CharacterRow = typeof characters.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;

function toProjectDto(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    goals: row.goals,
    progress: row.progress,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function listProjects(db: Db, regionId?: number): Promise<{ items: ProjectDto[] }> {
  const rows =
    regionId === undefined
      ? await db.select().from(projects)
      : await db.select().from(projects).where(eq(projects.regionId, regionId));
  return { items: rows.map(toProjectDto) };
}

async function contributionSummary(tx: Tx | Db, projectId: string, characterId: string) {
  const rows = await tx
    .select({
      characterId: contributions.characterId,
      resource: contributions.resource,
      qty: contributions.qty,
    })
    .from(contributions)
    .where(eq(contributions.projectId, projectId));
  const myContribution: Record<string, number> = {};
  const contributors = new Set<string>();
  for (const r of rows) {
    contributors.add(r.characterId);
    if (r.characterId === characterId) {
      myContribution[r.resource] = (myContribution[r.resource] ?? 0) + r.qty;
    }
  }
  return { myContribution, contributorCount: contributors.size };
}

export async function getProjectDetail(
  db: Db,
  projectId: string,
  characterId: string,
): Promise<ProjectDetailDto> {
  const row = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!row) throw new AppError('NOT_FOUND', 404);
  const summary = await contributionSummary(db, projectId, characterId);
  return { ...toProjectDto(row), ...summary };
}

/** Completes any active `project` quest at this project's step for every contributor. */
async function completeProjectQuests(tx: Tx, projectId: string): Promise<void> {
  const contributorRows = await tx
    .selectDistinct({ characterId: contributions.characterId })
    .from(contributions)
    .where(eq(contributions.projectId, projectId));
  for (const { characterId } of contributorRows) {
    const active = await tx
      .select({ cq: characterQuests, quest: quests })
      .from(characterQuests)
      .innerJoin(quests, eq(characterQuests.questId, quests.id))
      .where(
        and(eq(characterQuests.characterId, characterId), eq(characterQuests.state, 'active')),
      );
    for (const { cq, quest } of active) {
      const graph = questGraphSchema.parse(quest.steps);
      const step = graph.steps.find((s) => s.id === cq.stepId);
      if (!step || step.kind !== 'project' || step.projectId !== projectId) continue;
      const progress = questProgressSchema.parse(cq.progress ?? { counts: {}, choices: {} });
      await completeStep(tx, characterId, quest.id, graph, step, progress, step.next);
    }
  }
}

export async function contribute(
  db: Db,
  character: CharacterRow,
  projectId: string,
  input: { resource: string; qty: number },
  now: Date,
): Promise<{
  detail: ProjectDetailDto;
  character: CharacterDto;
  completed: boolean;
  credited: boolean;
  regionId: number;
}> {
  const itemId = RESOURCE_ITEM_IDS[input.resource];
  if (!itemId) throw new AppError('VALIDATION_ERROR', 400);

  return db.transaction(async (tx) => {
    const [proj] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update');
    if (!proj) throw new AppError('NOT_FOUND', 404);
    if (proj.completedAt) throw new AppError('PROJECT_COMPLETED', 409);

    const goal = proj.goals[input.resource] ?? 0;
    const current = proj.progress[input.resource] ?? 0;
    const remaining = goal - current;

    const [charRow] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, character.id))
      .for('update');
    if (!charRow) throw new Error('character vanished mid-transaction');
    const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, charRow.hexId) });
    const staminaNow = computeStamina(
      { stamina: charRow.stamina, staminaUpdatedAt: charRow.staminaUpdatedAt },
      now,
      hex ? regenContextFor(hex) : 'field',
    );

    const mult = deriveSkillModifiers(charRow.learnedSkills).contributionMult;
    const plan = planContribution(input.qty, mult, remaining);

    let completed = false;
    if (plan.creditGiven > 0) {
      if (staminaNow.stamina < CONTRIBUTION_STAMINA_COST) {
        throw new AppError('INSUFFICIENT_STAMINA', 409, {
          required: CONTRIBUTION_STAMINA_COST,
          current: staminaNow.stamina,
        });
      }
      const debited = await removeMaterialQty(tx, character.id, itemId, plan.rawNeeded);
      if (!debited) throw new AppError('INSUFFICIENT_MATERIALS', 409);

      const newProgress = { ...proj.progress, [input.resource]: current + plan.creditGiven };
      await tx.update(projects).set({ progress: newProgress }).where(eq(projects.id, projectId));
      await tx.insert(contributions).values({
        projectId,
        characterId: character.id,
        resource: input.resource,
        qty: plan.rawNeeded,
      });

      const reward = contributionReward(plan.creditGiven);
      const xp = applyXp(charRow, reward.xp);
      await tx
        .update(characters)
        .set({
          stamina: staminaNow.stamina - CONTRIBUTION_STAMINA_COST,
          staminaUpdatedAt: staminaNow.staminaUpdatedAt,
          xp: xp.xp,
          level: xp.level,
          attributePoints: xp.attributePoints,
          skillPoints: xp.skillPoints,
          ashCrowns: charRow.ashCrowns + reward.ashCrowns,
        })
        .where(eq(characters.id, character.id));

      const goalsMet = Object.entries(proj.goals).every(([k, g]) => (newProgress[k] ?? 0) >= g);
      if (goalsMet) {
        const [claimed] = await tx
          .update(projects)
          .set({ completedAt: now })
          .where(and(eq(projects.id, projectId), sql`${projects.completedAt} IS NULL`))
          .returning();
        if (claimed) {
          completed = true;
          await completeProjectQuests(tx, projectId);
        }
      }
    }

    const freshChar = (
      await tx.select().from(characters).where(eq(characters.id, character.id))
    )[0]!;
    const freshHex = await tx.query.hexes.findFirst({ where: eq(hexes.id, freshChar.hexId) });
    const projRow = (await tx.select().from(projects).where(eq(projects.id, projectId)))[0]!;
    const summary = await contributionSummary(tx, projectId, character.id);

    return {
      detail: { ...toProjectDto(projRow), ...summary },
      character: toCharacterDto(freshChar, freshHex!, now),
      completed,
      credited: plan.creditGiven > 0,
      regionId: proj.regionId,
    };
  });
}
