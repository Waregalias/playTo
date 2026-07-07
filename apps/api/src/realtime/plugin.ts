import { eq } from 'drizzle-orm';
import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { wsClientMessageSchema } from '@aldenfer/shared';
import type { Auth } from '../auth.js';
import { characters, hexes } from '../db/schema.js';
import { requestHeaders } from '../plugins/auth.js';
import { postChatMessage } from '../modules/chat/service.js';
import { ConnectionRegistry } from './registry.js';
import { SlidingWindowRateLimiter } from './rate-limit.js';

declare module 'fastify' {
  interface FastifyInstance {
    realtime: ConnectionRegistry;
  }
}

function safeText(raw: Buffer): string {
  try {
    return raw.toString();
  } catch {
    return '';
  }
}

/**
 * Mounts the authenticated `/ws` endpoint (API-SPEC §4) and decorates `app.realtime`.
 * Services call `app.realtime.publish(channel, type, data, at)` after commit to fan out.
 */
export async function registerRealtime(
  app: FastifyInstance,
  auth: Auth,
  now: () => Date,
): Promise<void> {
  app.decorate('realtime', new ConnectionRegistry());
  const chatLimiter = new SlidingWindowRateLimiter(10, 60_000);
  await app.register(fastifyWebsocket);

  app.get('/ws', { websocket: true }, async (socket, request) => {
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    if (!session) {
      socket.close(1008, 'UNAUTHENTICATED');
      return;
    }
    const character = await app.db.query.characters.findFirst({
      where: eq(characters.userId, session.user.id),
    });
    if (!character) {
      socket.close(1008, 'NO_CHARACTER');
      return;
    }
    const hex = await app.db.query.hexes.findFirst({ where: eq(hexes.id, character.hexId) });
    const regionId = hex?.regionId ?? 0;
    app.realtime.add(socket, ['global', `region:${regionId}`, `character:${character.id}`]);
    socket.on('close', () => app.realtime.remove(socket));

    socket.on('message', (raw: Buffer) => {
      void handleChatFrame(raw);
    });

    async function handleChatFrame(raw: Buffer): Promise<void> {
      try {
        const parsed = wsClientMessageSchema.safeParse(JSON.parse(safeText(raw)));
        if (!parsed.success) return; // ignore malformed frames
        const at = now().toISOString();
        if (!chatLimiter.tryConsume(character!.id, now().getTime())) {
          socket.send(
            JSON.stringify({ channel: parsed.data.channel, type: 'chat.throttled', data: {}, at }),
          );
          return;
        }
        const dto = await postChatMessage(
          app.db,
          character!,
          parsed.data.channel,
          parsed.data.body,
        );
        app.realtime.publish(parsed.data.channel, 'chat.message', dto, dto.at);
      } catch {
        // malformed / non-JSON frame — ignore
      }
    }
  });
}
