import { z } from 'zod';

/** Client intentions, M1: move and rest only (SPEC-M1). */
export const createActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), targetHexId: z.uuid() }),
  z.object({ type: z.literal('rest') }),
]);

export const actionTypeSchema = z.enum(['move', 'rest']);

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

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type ActionDto = z.infer<typeof actionSchema>;
