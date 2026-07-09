import { z } from 'zod';
import { TERRAINS } from '../constants/terrains.js';

export const terrainSchema = z.enum(TERRAINS);
export const mistLevelSchema = z.number().int().min(0).max(3);

export const regionSchema = z.object({
  id: z.number().int().min(0),
  slug: z.string(),
  name: z.string(),
  unlocked: z.boolean(),
  mistLevel: mistLevelSchema,
  emberLit: z.boolean(),
});

export const regionsResponseSchema = z.object({
  items: z.array(regionSchema),
});

/** A hex the character has discovered: full data. */
export const discoveredHexSchema = z.object({
  id: z.uuid(),
  q: z.number().int(),
  r: z.number().int(),
  discovered: z.literal(true),
  terrain: terrainSchema,
  mistLevel: mistLevelSchema,
  poi: z
    .object({
      type: z.string(),
      searchedToday: z.boolean(),
    })
    .nullish(),
});

/** An adjacent, not-yet-visited hex: silhouette only (US2). */
export const fogHexSchema = z.object({
  id: z.uuid(),
  q: z.number().int(),
  r: z.number().int(),
  discovered: z.literal(false),
});

export const hexSchema = z.discriminatedUnion('discovered', [discoveredHexSchema, fogHexSchema]);

export const hexesResponseSchema = z.object({
  items: z.array(hexSchema),
});

export type RegionDto = z.infer<typeof regionSchema>;
export type DiscoveredHexDto = z.infer<typeof discoveredHexSchema>;
export type FogHexDto = z.infer<typeof fogHexSchema>;
export type HexDto = z.infer<typeof hexSchema>;
