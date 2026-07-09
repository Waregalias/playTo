import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters } from '../../db/schema.js';
import { postChatMessage } from './service.js';
import type { Db } from '../../db/client.js';

let app: FastifyInstance;
let db: Db;
const NOW = new Date('2026-07-04T12:00:00Z');

async function signUp(email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: 'motdepasse-solide', name: email.split('@')[0] },
  });
  expect(response.statusCode).toBe(200);
  const cookies = response.headers['set-cookie'];
  return (Array.isArray(cookies) ? cookies : [cookies])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

async function makeCharacter(cookie: string, name: string) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/characters',
    headers: { cookie },
    payload: { name, class: 'blade' },
  });
  const row = await db.query.characters.findFirst({ where: eq(characters.name, name) });
  return row!;
}

beforeAll(async () => {
  db = await setupTestDb();
  app = await buildApp(TEST_ENV, { db, now: () => NOW });
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetTestDb(db);
});

describe('GET /api/v1/chat/:channel', () => {
  it('returns channel messages newest-first with author names', async () => {
    const cookie = await signUp('chat@aldenfer.test');
    const char = await makeCharacter(cookie, 'Talker');
    await postChatMessage(db, char, 'global', 'premier');
    await postChatMessage(db, char, 'global', 'second');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chat/global',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].body).toBe('second'); // newest first
    expect(body.items[0].characterName).toBe('Talker');
    expect(body.nextCursor).toBeNull();
  });

  it('rejects an unknown channel (400)', async () => {
    const cookie = await signUp('chat2@aldenfer.test');
    await makeCharacter(cookie, 'Talker2');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chat/region:9',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires authentication (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/chat/global' });
    expect(res.statusCode).toBe(401);
  });
});
