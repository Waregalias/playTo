import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createCharacterSchema, characterSchema } from '@aldenfer/shared';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { Auth } from '../../auth.js';
import { requireUser } from '../../plugins/auth.js';
import { AppError } from '../../lib/app-error.js';
import { characters } from '../../db/schema.js';
import { resolveDueActions } from '../actions/service.js';
import { createCharacter, getMyCharacter } from './service.js';

export function registerCharacterRoutes(
  app: FastifyInstance,
  auth: Auth,
  now: () => Date,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/v1/characters',
    {
      schema: {
        body: createCharacterSchema,
        response: { 201: characterSchema },
      },
    },
    async (request, reply) => {
      const { userId } = await requireUser(auth, request);
      const character = await createCharacter(app.db, userId, request.body, now());
      return reply.status(201).send(character);
    },
  );

  typed.get(
    '/api/v1/characters/me',
    {
      schema: {
        response: { 200: characterSchema, 404: z.any() },
      },
    },
    async (request, reply) => {
      const { userId } = await requireUser(auth, request);
      const row = await app.db.query.characters.findFirst({
        where: eq(characters.userId, userId),
      });
      if (!row) {
        throw new AppError('NOT_FOUND', 404);
      }
      // Lazy resolution: due actions land before any state is reported.
      await resolveDueActions(app.db, row.id, now());
      const character = await getMyCharacter(app.db, userId, now());
      if (!character) {
        throw new AppError('NOT_FOUND', 404);
      }
      return reply.send(character);
    },
  );
}
