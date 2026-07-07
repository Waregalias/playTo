import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { chatChannelSchema, chatHistorySchema } from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { listChatHistory } from './service.js';

export function registerChatRoutes(app: FastifyInstance, auth: Auth, _now: () => Date): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    '/api/v1/chat/:channel',
    {
      schema: {
        params: z.object({ channel: chatChannelSchema }),
        querystring: z.object({ cursor: z.string().optional() }),
        response: { 200: chatHistorySchema },
      },
    },
    async (request) => {
      await requireCharacter(app.db, auth, request); // 401/404 gate
      return listChatHistory(app.db, request.params.channel, request.query.cursor);
    },
  );
}
