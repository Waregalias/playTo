import { z } from 'zod';

/** Client intentions — M2 adds `search` on the current hex (SPEC-M2 US4). */
export const createActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), targetHexId: z.uuid() }),
  z.object({ type: z.literal('rest') }),
  z.object({ type: z.literal('search') }),
]);

export const actionTypeSchema = z.enum(['move', 'rest', 'search']);

export const actionSchema = z.object({
  id: z.uuid(),
  type: actionTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  position: z.number().int().min(0).max(2),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  resolved: z.boolean(),
});

export const actionsResponseSchema = z.object({
  items: z.array(actionSchema),
});

// ── JSONB payloads persisted in action_queue (rule: every JSONB column
// is validated by a shared schema before writing).

export const movePayloadSchema = z.object({
  targetHexId: z.uuid(),
  /** Stamina debited at enqueue time — refunded verbatim on cancel. */
  staminaCost: z.number().int().min(0),
  durationSeconds: z.number().int().positive(),
});

export const restPayloadSchema = z.object({
  durationSeconds: z.number().int().positive(),
  staminaGain: z.number().int().positive(),
});

export const searchPayloadSchema = z.object({
  hexId: z.uuid(),
  poiType: z.string(),
  /** UTC day (YYYY-MM-DD) claimed in the daily ledger at enqueue time. */
  searchedOn: z.string(),
  durationSeconds: z.number().int().positive(),
  staminaCost: z.number().int().min(0),
});

const encounterFields = {
  /** Set when the resolution rolled a Mistborn encounter (SPEC-M2 US1). */
  encounterFoeSlug: z.string().optional(),
  combatId: z.uuid().optional(),
};

export const moveResultSchema = z.object({
  movedToHexId: z.uuid(),
  discoveredHexIds: z.array(z.uuid()),
  ...encounterFields,
});

export const restResultSchema = z.object({
  staminaGained: z.number().int().min(0),
});

export const searchResultSchema = z.object({
  xp: z.number().int().min(0),
  loot: z.array(z.object({ itemId: z.string(), qty: z.number().int().positive() })),
  lootLost: z.array(z.object({ itemId: z.string(), qty: z.number().int().positive() })).optional(),
  ...encounterFields,
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type ActionDto = z.infer<typeof actionSchema>;
export type MovePayload = z.infer<typeof movePayloadSchema>;
export type RestPayload = z.infer<typeof restPayloadSchema>;
export type SearchPayload = z.infer<typeof searchPayloadSchema>;
export type MoveResult = z.infer<typeof moveResultSchema>;
export type RestResult = z.infer<typeof restResultSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
