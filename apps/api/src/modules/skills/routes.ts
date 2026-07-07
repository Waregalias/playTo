import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { characterSchema, equipSkillsSchema, learnSkillSchema } from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { learnSkill, equipSkills } from './service.js';

export function registerSkillRoutes(app: FastifyInstance, auth: Auth, now: () => Date): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/v1/characters/me/skills',
    { schema: { body: learnSkillSchema, response: { 200: characterSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return learnSkill(app.db, character, request.body.skillId, now());
    },
  );

  typed.put(
    '/api/v1/characters/me/skills/equipped',
    { schema: { body: equipSkillsSchema, response: { 200: characterSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return equipSkills(app.db, character, request.body, now());
    },
  );
}
