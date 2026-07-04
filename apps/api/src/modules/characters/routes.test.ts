import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
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
  const cookie = (Array.isArray(cookies) ? cookies : [cookies])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
  expect(cookie).toContain('better-auth');
  return cookie;
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

describe('POST /api/v1/characters (US1)', () => {
  it('creates a character at the Ember Hall with class base stats', async () => {
    const cookie = await signUp('rekindled@aldenfer.test');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie },
      payload: { name: 'Serelle', class: 'blade' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Serelle');
    expect(body.class).toBe('blade');
    expect(body.attributes).toEqual({ str: 8, dex: 5, wil: 4, vit: 9, fer: 4 });
    expect(body.hpMax).toBe(30 + 9 * 8);
    expect(body.stamina).toBe(100);
    expect(body.regionId).toBe(0);
    expect(body.currencies).toEqual({ ashCrowns: 0, emberFragments: 0, gloryMarks: 0 });
  });

  it('rejects a second character for the same account (409 CHARACTER_EXISTS)', async () => {
    const cookie = await signUp('rekindled@aldenfer.test');
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie },
      payload: { name: 'Serelle', class: 'blade' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie },
      payload: { name: 'Kordan', class: 'scout' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('CHARACTER_EXISTS');
  });

  it('rejects a taken name (409 NAME_TAKEN)', async () => {
    const cookieA = await signUp('a@aldenfer.test');
    await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie: cookieA },
      payload: { name: 'Serelle', class: 'blade' },
    });

    const cookieB = await signUp('b@aldenfer.test');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie: cookieB },
      payload: { name: 'Serelle', class: 'cantor' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('NAME_TAKEN');
  });

  it('rejects an invalid name (400 VALIDATION_ERROR)', async () => {
    const cookie = await signUp('rekindled@aldenfer.test');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie },
      payload: { name: 'Yo', class: 'blade' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests (401)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      payload: { name: 'Serelle', class: 'blade' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/v1/characters/me', () => {
  it('returns the character with recomputed stamina', async () => {
    const cookie = await signUp('rekindled@aldenfer.test');
    await app.inject({
      method: 'POST',
      url: '/api/v1/characters',
      headers: { cookie },
      payload: { name: 'Serelle', class: 'arcanist' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/characters/me',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Serelle');
    expect(body.xpNext).toBe(100);
    expect(body.stamina).toBe(100);
  });

  it('returns 404 when no character exists yet', async () => {
    const cookie = await signUp('fresh@aldenfer.test');
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/characters/me',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
