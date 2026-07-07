import { z } from 'zod';

/** Chat channels available in M3 (company channels arrive with M5). */
export const chatChannelSchema = z.enum(['global', 'region:1']);

export const chatMessageSchema = z.object({
  id: z.uuid(),
  channel: chatChannelSchema,
  characterId: z.uuid(),
  characterName: z.string(),
  body: z.string().min(1).max(500),
  at: z.iso.datetime(),
});

/** Client → server message over `/ws`. Only `chat.send` exists in M3. */
export const chatSendSchema = z.object({
  type: z.literal('chat.send'),
  channel: chatChannelSchema,
  body: z.string().min(1).max(500),
});

/** Paginated chat history (`GET /chat/:channel` — API-SPEC §3). */
export const chatHistorySchema = z.object({
  items: z.array(chatMessageSchema),
  nextCursor: z.string().nullable(),
});

export type ChatChannel = z.infer<typeof chatChannelSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
export type ChatSendInput = z.infer<typeof chatSendSchema>;
export type ChatHistoryDto = z.infer<typeof chatHistorySchema>;
