import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { createActionSchema, actionSchema, actionsResponseSchema, type Rng } from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { actionQueue } from '../../db/schema.js';
import { requireCharacter } from '../../lib/require-character.js';
import { enqueueAction, cancelAction, resolveDueActions, toActionDto } from './service.js';

export function registerActionRoutes(
  app: FastifyInstance,
  auth: Auth,
  now: () => Date,
  rng: Rng,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/actions',
    { schema: { response: { 200: actionsResponseSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      await resolveDueActions(app.db, character.id, now(), rng);
      const rows = await app.db
        .select()
        .from(actionQueue)
        .where(and(eq(actionQueue.characterId, character.id), eq(actionQueue.resolved, false)))
        .orderBy(asc(actionQueue.position));
      return { items: rows.map(toActionDto) };
    },
  );

  typed.post(
    '/api/v1/actions',
    { schema: { body: createActionSchema, response: { 201: actionSchema } } },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      const action = await enqueueAction(app.db, character.id, request.body, now(), rng);
      return reply.status(201).send(action);
    },
  );

  typed.delete(
    '/api/v1/actions/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      await cancelAction(app.db, character.id, request.params.id, now(), rng);
      return reply.status(204).send();
    },
  );
}
