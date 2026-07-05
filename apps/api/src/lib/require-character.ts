import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { Db } from '../db/client.js';
import type { Auth } from '../auth.js';
import { characters } from '../db/schema.js';
import { requireUser } from '../plugins/auth.js';
import { AppError } from './app-error.js';

type CharacterRow = typeof characters.$inferSelect;

/** Authenticated user → their character row, or 404. */
export async function requireCharacter(
  db: Db,
  auth: Auth,
  request: FastifyRequest,
): Promise<CharacterRow> {
  const { userId } = await requireUser(auth, request);
  const character = await db.query.characters.findFirst({
    where: eq(characters.userId, userId),
  });
  if (!character) {
    throw new AppError('NOT_FOUND', 404);
  }
  return character;
}
