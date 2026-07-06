import { z } from 'zod';

export const combatActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('attack') }),
  z.object({ action: z.literal('skill'), skillId: z.string() }),
  z.object({ action: z.literal('item'), itemId: z.string() }),
  z.object({ action: z.literal('flee') }),
]);

export const combatLogEntrySchema = z.object({
  turn: z.number().int().positive(),
  actor: z.enum(['player', 'foe', 'system']),
  text: z.string(),
  dmg: z.number().int().optional(),
});

export const combatStatusSchema = z.enum(['active', 'won', 'lost', 'fled']);

export const combatRewardsSchema = z.object({
  xp: z.number().int().min(0),
  ashCrowns: z.number().int().min(0),
  loot: z.array(z.object({ itemId: z.string(), qty: z.number().int().positive() })),
  /** New level reached, when the fight leveled the character up. */
  levelUp: z.number().int().positive().optional(),
  /** Loot dropped because the bag was full (US2). */
  lootLost: z.array(z.object({ itemId: z.string(), qty: z.number().int().positive() })).optional(),
});

/** API-SPEC §3 CombatState (M2 shape). */
export const combatStateSchema = z.object({
  id: z.uuid(),
  foe: z.object({
    slug: z.string(),
    hp: z.number().int().min(0),
    hpMax: z.number().int().positive(),
  }),
  playerHp: z.number().int().min(0),
  playerHpMax: z.number().int().positive(),
  turn: z.number().int().positive(),
  cooldowns: z.record(z.string(), z.number().int().min(0)),
  log: z.array(combatLogEntrySchema),
  status: combatStatusSchema,
  rewards: combatRewardsSchema.nullish(),
});

/** POST /combat body — quest-triggered fights (SPEC-M2 US6). */
export const createCombatSchema = z.object({
  source: z.literal('quest'),
  questId: z.string(),
});

export type CombatActionInput = z.infer<typeof combatActionSchema>;
export type CombatLogEntry = z.infer<typeof combatLogEntrySchema>;
export type CombatStateDto = z.infer<typeof combatStateSchema>;
export type CombatRewards = z.infer<typeof combatRewardsSchema>;
