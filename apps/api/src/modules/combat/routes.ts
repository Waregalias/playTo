import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { combatActionSchema, combatStateSchema, createCombatSchema, maxHp, type Rng } from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { AppError } from '../../lib/app-error.js';
import { getActiveCombat, playTurn, toCombatStateDto } from './service.js';
import { startQuestCombat } from '../quests/service.js';

export function registerCombatRoutes(
  app: FastifyInstance,
  auth: Auth,
  now: () => Date,
  rng: Rng,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/combat/current',
    { schema: { response: { 200: z.object({ combat: combatStateSchema.nullable() }) } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      const combat = await getActiveCombat(app.db, character.id);
      return { combat: combat ? toCombatStateDto(combat, maxHp(character.vit)) : null };
    },
  );

  typed.post(
    '/api/v1/combat',
    { schema: { body: createCombatSchema, response: { 201: combatStateSchema } } },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      const combatId = await startQuestCombat(app.db, character.id, request.body.questId, now(), rng);
      const combat = await getActiveCombat(app.db, character.id);
      if (!combat || combat.id !== combatId) {
        // The opening blow can end a fight instantly — return it anyway.
        throw new AppError('NO_ACTIVE_COMBAT', 409);
      }
      return reply.status(201).send(toCombatStateDto(combat, maxHp(character.vit)));
    },
  );

  typed.post(
    '/api/v1/combat/:id/turn',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: combatActionSchema,
        response: { 200: combatStateSchema },
      },
    },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      const outcome = await playTurn(app.db, character.id, request.body, now(), rng);
      if (outcome.combat.id !== request.params.id) {
        throw new AppError('NOT_FOUND', 404);
      }
      return toCombatStateDto(outcome.combat, maxHp(character.vit));
    },
  );
}
