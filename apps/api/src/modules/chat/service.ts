import { and, desc, eq, lt } from 'drizzle-orm';
import type { ChatHistoryDto, ChatMessageDto } from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { chatMessages, characters } from '../../db/schema.js';

const PAGE = 50;

export async function postChatMessage(
  db: Db,
  character: { id: string; name: string },
  channel: string,
  body: string,
): Promise<ChatMessageDto> {
  const [row] = await db
    .insert(chatMessages)
    .values({ channel, characterId: character.id, body })
    .returning();
  if (!row) throw new Error('chat insert returned no row');
  return {
    id: row.id,
    channel: channel as ChatMessageDto['channel'],
    characterId: character.id,
    characterName: character.name,
    body: row.body,
    at: row.createdAt.toISOString(),
  };
}

export async function listChatHistory(
  db: Db,
  channel: string,
  cursor?: string,
): Promise<ChatHistoryDto> {
  const rows = await db
    .select({
      id: chatMessages.id,
      characterId: chatMessages.characterId,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      characterName: characters.name,
    })
    .from(chatMessages)
    .innerJoin(characters, eq(chatMessages.characterId, characters.id))
    .where(
      cursor
        ? and(eq(chatMessages.channel, channel), lt(chatMessages.createdAt, new Date(cursor)))
        : eq(chatMessages.channel, channel),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(PAGE);

  const items = rows.map((r) => ({
    id: r.id,
    channel: channel as ChatMessageDto['channel'],
    characterId: r.characterId,
    characterName: r.characterName,
    body: r.body,
    at: r.createdAt.toISOString(),
  }));
  const nextCursor = items.length === PAGE ? items[items.length - 1]!.at : null;
  return { items, nextCursor };
}
