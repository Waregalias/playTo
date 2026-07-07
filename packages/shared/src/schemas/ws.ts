import { z } from 'zod';
import { chatSendSchema } from './chat.js';

/** Client → server messages over `/ws`. Only `chat.send` in M3. */
export const wsClientMessageSchema = chatSendSchema;

/** Server → client envelope (API-SPEC §4). `data` shape depends on `type`. */
export const wsServerEventSchema = z.object({
  channel: z.string(),
  type: z.string(),
  data: z.unknown(),
  at: z.string(),
});

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;
export type WsServerEvent = z.infer<typeof wsServerEventSchema>;
