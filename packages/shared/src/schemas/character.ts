import { z } from 'zod';
import { CHARACTER_CLASSES } from '../constants/classes.js';
import { characterSkillSchema } from './skill.js';

export const characterClassSchema = z.enum(CHARACTER_CLASSES);

export const characterNameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[\p{L}][\p{L}\p{N}' -]*$/u);

export const createCharacterSchema = z.object({
  name: characterNameSchema,
  class: characterClassSchema,
});

export const attributesSchema = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  wil: z.number().int(),
  vit: z.number().int(),
  fer: z.number().int(),
});

/** Character payload returned by the API (API-SPEC §3), M1 subset. */
export const characterSchema = z.object({
  id: z.uuid(),
  name: characterNameSchema,
  class: characterClassSchema,
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  xpNext: z.number().int().positive(),
  attributes: attributesSchema,
  attributePoints: z.number().int().min(0),
  skillPoints: z.number().int().min(0),
  hp: z.number().int().min(0),
  hpMax: z.number().int().positive(),
  stamina: z.number().int().min(0).max(100),
  staminaMax: z.number().int().positive(),
  deathPenaltyUntil: z.iso.datetime().nullish(),
  activeCombatId: z.uuid().nullish(),
  hexId: z.uuid(),
  regionId: z.number().int().min(0),
  currencies: z.object({
    ashCrowns: z.number().int().min(0),
    emberFragments: z.number().int().min(0),
    gloryMarks: z.number().int().min(0),
  }),
  skills: z.array(characterSkillSchema),
});

export type CharacterClassInput = z.infer<typeof characterClassSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type CharacterDto = z.infer<typeof characterSchema>;
