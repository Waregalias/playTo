import { z } from 'zod';
import { characterSchema } from './character.js';

/** Non-monetary materials (GLOSSARY §Monnaies & ressources). */
export const RESOURCE_KEYS = [
  'shadewood',
  'sootOre',
  'moorHerbs',
  'mistbornHide',
  'ashGlass',
  'mistEssence',
] as const;
export const resourceSchema = z.enum(RESOURCE_KEYS);
export type ResourceKey = z.infer<typeof resourceSchema>;

export const contributeSchema = z.object({
  resource: resourceSchema,
  qty: z.number().int().positive(),
});

// Plain string keys: a project stores only the resources it needs, not every
// resource. (Zod 4's z.record(enum, …) would require ALL enum keys to be present.)
const goalRecord = z.record(z.string(), z.number().int().nonnegative());

/** Community project (`GET /projects?regionId=` — API-SPEC §3). */
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  goals: goalRecord,
  progress: goalRecord,
  completedAt: z.iso.datetime().nullish(),
});

/** Extended detail for the chantier UI (`GET /projects/:id` — SPEC-M3 décision 6). */
export const projectDetailSchema = projectSchema.extend({
  myContribution: goalRecord,
  contributorCount: z.number().int().nonnegative(),
});

/** `POST /projects/:id/contribute` response (API-SPEC §3). */
export const contributeResponseSchema = z.object({
  project: projectDetailSchema,
  character: characterSchema,
});

export type ProjectDto = z.infer<typeof projectSchema>;
export type ProjectDetailDto = z.infer<typeof projectDetailSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
export type ContributeResponse = z.infer<typeof contributeResponseSchema>;
