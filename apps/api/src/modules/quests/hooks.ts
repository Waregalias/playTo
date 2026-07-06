import { and, eq } from 'drizzle-orm';
import {
  questGraphSchema,
  questProgressSchema,
  questRewardsSchema,
  type QuestGraph,
  type QuestProgress,
  type QuestStep,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characterQuests, quests } from '../../db/schema.js';
import { grantRewards } from './rewards.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** World events that can advance a quest step (SPEC-M2 US6). */
export type QuestEvent =
  | { kind: 'reach'; poiType: string | null }
  | { kind: 'search'; poiType: string }
  | { kind: 'kill'; foeSlug: string }
  | { kind: 'combat-won'; questId: string; foeSlug: string };

function findStep(graph: QuestGraph, stepId: string): QuestStep | undefined {
  return graph.steps.find((s) => s.id === stepId);
}

function stepMatches(step: QuestStep, event: QuestEvent, questId: string): boolean {
  switch (step.kind) {
    case 'reach':
      return event.kind === 'reach' && event.poiType === step.poiType;
    case 'search':
      return event.kind === 'search' && event.poiType === step.poiType;
    case 'kill':
      return event.kind === 'kill' && event.foeSlug === step.foeSlug;
    case 'combat':
      return (
        event.kind === 'combat-won' &&
        event.questId === questId &&
        event.foeSlug === step.foeSlug
      );
    case 'choice':
      return false; // choices advance through the advance route, not events
  }
}

/**
 * Feeds a world event to every active quest of the character, advancing
 * matching steps. Runs inside the transaction of the triggering effect
 * (move/search resolution, combat victory) so progress is never lost.
 */
export async function advanceOnEvent(
  tx: Tx,
  characterId: string,
  event: QuestEvent,
): Promise<void> {
  const active = await tx
    .select({ cq: characterQuests, quest: quests })
    .from(characterQuests)
    .innerJoin(quests, eq(characterQuests.questId, quests.id))
    .where(and(eq(characterQuests.characterId, characterId), eq(characterQuests.state, 'active')));

  for (const { cq, quest } of active) {
    const graph = questGraphSchema.parse(quest.steps);
    const step = findStep(graph, cq.stepId);
    if (!step || !stepMatches(step, event, quest.id)) continue;

    const progress: QuestProgress = questProgressSchema.parse(
      cq.progress ?? { counts: {}, choices: {} },
    );

    if (step.kind === 'kill') {
      const count = (progress.counts[step.id] ?? 0) + 1;
      progress.counts[step.id] = count;
      if (count < step.count) {
        await tx
          .update(characterQuests)
          .set({ progress })
          .where(
            and(eq(characterQuests.characterId, characterId), eq(characterQuests.questId, quest.id)),
          );
        continue;
      }
    }

    await completeStep(tx, characterId, quest.id, graph, step, progress, step.next);
  }
}

/**
 * Grants the step's extra rewards and moves to `next` — completing the
 * quest (base rewards) when next is null. Shared by hooks and the
 * choice/advance route.
 */
export async function completeStep(
  tx: Tx,
  characterId: string,
  questId: string,
  graph: QuestGraph,
  step: QuestStep,
  progress: QuestProgress,
  next: string | null,
  extraRewards = step.kind === 'choice' ? undefined : step.extraRewards,
): Promise<void> {
  if (extraRewards) {
    await grantRewards(tx, characterId, extraRewards);
  }

  if (next === null) {
    const quest = await tx.query.quests.findFirst({ where: eq(quests.id, questId) });
    if (quest) {
      await grantRewards(tx, characterId, questRewardsSchema.parse(quest.rewards));
    }
    await tx
      .update(characterQuests)
      .set({ state: 'done', progress })
      .where(and(eq(characterQuests.characterId, characterId), eq(characterQuests.questId, questId)));
    return;
  }

  await tx
    .update(characterQuests)
    .set({ stepId: next, progress })
    .where(and(eq(characterQuests.characterId, characterId), eq(characterQuests.questId, questId)));
}
