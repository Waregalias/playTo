import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { regionsResponseSchema, hexesResponseSchema } from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { AppError } from '../../lib/app-error.js';
import { resolveDueActions } from '../actions/service.js';
import { listRegions, listRegionHexes } from './service.js';

export function registerMapRoutes(
  app: FastifyInstance,
  auth: Auth,
  now: () => Date,
  rng: () => number,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/map/regions',
    { schema: { response: { 200: regionsResponseSchema } } },
    async (request) => {
      await requireCharacter(app.db, auth, request);
      return { items: await listRegions(app.db) };
    },
  );

  typed.get(
    '/api/v1/map/regions/:id/hexes',
    {
      schema: {
        params: z.object({ id: z.coerce.number().int().min(0) }),
        response: { 200: hexesResponseSchema },
      },
    },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      await resolveDueActions(app.db, character.id, now(), rng);
      const items = await listRegionHexes(app.db, character.id, request.params.id);
      if (items === null) {
        throw new AppError('NOT_FOUND', 404);
      }
      return { items };
    },
  );
}
