import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { advanceQuestSchema, characterQuestSchema, questsResponseSchema } from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { resolveDueActions } from '../actions/service.js';
import { listQuests, acceptQuest, advanceQuest } from './service.js';

export function registerQuestRoutes(
  app: FastifyInstance,
  auth: Auth,
  now: () => Date,
  rng: () => number,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/quests',
    { schema: { response: { 200: questsResponseSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      await resolveDueActions(app.db, character.id, now(), rng);
      return { items: await listQuests(app.db, character.id) };
    },
  );

  typed.post(
    '/api/v1/quests/:questId/accept',
    {
      schema: {
        params: z.object({ questId: z.string() }),
        response: { 201: characterQuestSchema },
      },
    },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      const quest = await acceptQuest(app.db, character.id, request.params.questId);
      return reply.status(201).send(quest);
    },
  );

  typed.post(
    '/api/v1/quests/:questId/advance',
    {
      schema: {
        params: z.object({ questId: z.string() }),
        body: advanceQuestSchema,
        response: { 200: characterQuestSchema },
      },
    },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return advanceQuest(app.db, character.id, request.params.questId, request.body);
    },
  );
}
