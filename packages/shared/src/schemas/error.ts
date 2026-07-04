import { z } from 'zod';

/** Business error codes (API-SPEC §2). */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INSUFFICIENT_STAMINA',
  'QUEUE_FULL',
  'NOT_ADJACENT',
  'HEX_LOCKED',
  'POI_ALREADY_SEARCHED',
  'ASSAULT_COOLDOWN',
  'RAID_CLOSED',
  'INSUFFICIENT_FUNDS',
  'INVENTORY_FULL',
  'REQUIREMENT_NOT_MET',
  'DEATH_PENALTY_ACTIVE',
  'COMBAT_ALREADY_ACTIVE',
  'NAME_TAKEN',
  'CHARACTER_EXISTS',
  'NOT_ON_SHRINE',
  'ACTION_ALREADY_STARTED',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
