import { z } from 'zod';

export const learnSkillSchema = z.object({ skillId: z.string() });

export const equipSkillsSchema = z.object({
  slot1: z.string().nullish(),
  slot2: z.string().nullish(),
});

export const characterSkillSchema = z.object({
  skillId: z.string(),
  equippedSlot: z.union([z.literal(1), z.literal(2)]).nullish(),
});

export type LearnSkillInput = z.infer<typeof learnSkillSchema>;
export type EquipSkillsInput = z.infer<typeof equipSkillsSchema>;
export type CharacterSkillDto = z.infer<typeof characterSkillSchema>;
