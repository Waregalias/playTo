import { z } from 'zod';

/**
 * Quest step graph (JSONB in the quests table — validated before write).
 * Progress hooks: 'reach' fires on move resolution, 'search' on search
 * resolution, 'kill' on combat victory, 'combat' is a scripted fight the
 * player launches from the quest step, 'choice' is a player decision.
 */
const stepBase = {
  id: z.string(),
  /** Next step id, null = quest complete. */
  next: z.string().nullable(),
  /** Extra rewards granted when this terminal step completes a branch. */
  extraRewards: z
    .object({
      xp: z.number().int().min(0).optional(),
      ashCrowns: z.number().int().min(0).optional(),
      skillPoints: z.number().int().min(0).optional(),
      items: z
        .array(z.object({ itemId: z.string(), qty: z.number().int().positive() }))
        .optional(),
    })
    .optional(),
};

export const questStepSchema = z.discriminatedUnion('kind', [
  z.object({ ...stepBase, kind: z.literal('reach'), poiType: z.string() }),
  z.object({ ...stepBase, kind: z.literal('search'), poiType: z.string() }),
  z.object({
    ...stepBase,
    kind: z.literal('kill'),
    foeSlug: z.string(),
    count: z.number().int().positive(),
  }),
  z.object({
    ...stepBase,
    kind: z.literal('combat'),
    foeSlug: z.string(),
    /** The fight can only be started while standing on this POI. */
    atPoiType: z.string(),
  }),
  z.object({
    ...stepBase,
    kind: z.literal('choice'),
    next: z.null(), // choices route through their options
    options: z
      .array(
        z.object({
          id: z.string(),
          next: z.string().nullable(),
          extraRewards: stepBase.extraRewards,
        }),
      )
      .min(2),
  }),
]);

export const questGraphSchema = z.object({
  start: z.string(),
  steps: z.array(questStepSchema).min(1),
});

/** Base rewards granted at quest completion (quests.rewards JSONB). */
export const questRewardsSchema = z.object({
  xp: z.number().int().min(0),
  ashCrowns: z.number().int().min(0).optional(),
  emberFragments: z.number().int().min(0).optional(),
  skillPoints: z.number().int().min(0).optional(),
  /** `$class` in an itemId resolves to the character's class server-side. */
  items: z.array(z.object({ itemId: z.string(), qty: z.number().int().positive() })).optional(),
});

/** quests.requires JSONB. */
export const questRequiresSchema = z.object({
  quest: z.string().optional(),
  level: z.number().int().positive().optional(),
});

export const questStateSchema = z.enum(['available', 'active', 'done', 'failed']);

/** character_quests.progress JSONB. */
export const questProgressSchema = z.object({
  /** Kill counters per step id. */
  counts: z.record(z.string(), z.number().int().min(0)).default({}),
  /** Choices made, step id → option id. */
  choices: z.record(z.string(), z.string()).default({}),
});

export const characterQuestSchema = z.object({
  questId: z.string(),
  state: questStateSchema,
  stepId: z.string(),
  progress: questProgressSchema.nullish(),
});

export const questsResponseSchema = z.object({
  items: z.array(characterQuestSchema),
});

export const advanceQuestSchema = z.object({
  stepId: z.string(),
  choice: z.string().optional(),
});

export type QuestStep = z.infer<typeof questStepSchema>;
export type QuestGraph = z.infer<typeof questGraphSchema>;
export type QuestRewards = z.infer<typeof questRewardsSchema>;
export type QuestProgress = z.infer<typeof questProgressSchema>;
export type CharacterQuestDto = z.infer<typeof characterQuestSchema>;
export type AdvanceQuestInput = z.infer<typeof advanceQuestSchema>;
