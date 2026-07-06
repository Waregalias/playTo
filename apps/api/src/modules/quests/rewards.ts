import { eq } from 'drizzle-orm';
import type { QuestRewards } from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters } from '../../db/schema.js';
import { applyXp } from '../../lib/progression.js';
import { addItem, inventoryCapacity } from '../inventory/service.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface StepRewards {
  xp?: number;
  ashCrowns?: number;
  emberFragments?: number;
  skillPoints?: number;
  items?: Array<{ itemId: string; qty: number }>;
}

/**
 * Grants quest/step rewards inside the caller's transaction.
 * `$class` in an item id resolves to the character's class (Q4 weapon).
 */
export async function grantRewards(
  tx: Tx,
  characterId: string,
  rewards: QuestRewards | StepRewards,
): Promise<void> {
  const [character] = await tx
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .for('update');
  if (!character) throw new Error(`Character ${characterId} missing`);

  const progress = applyXp(character, rewards.xp ?? 0);

  await tx
    .update(characters)
    .set({
      xp: progress.xp,
      level: progress.level,
      attributePoints: progress.attributePoints,
      skillPoints: progress.skillPoints + (rewards.skillPoints ?? 0),
      ashCrowns: character.ashCrowns + (rewards.ashCrowns ?? 0),
      emberFragments: character.emberFragments + (rewards.emberFragments ?? 0),
    })
    .where(eq(characters.id, characterId));

  for (const item of rewards.items ?? []) {
    const itemId = item.itemId.replace('$class', character.class);
    await addItem(tx, characterId, itemId, item.qty, inventoryCapacity(character.str));
  }
}
