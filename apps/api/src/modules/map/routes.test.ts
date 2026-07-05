import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import type { Db } from '../../db/client.js';

let app: FastifyInstance;
let db: Db;
const NOW = new Date('2026-07-05T12:00:00Z');

async function createRavive(): Promise<string> {
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email: 'ravive@aldenfer.test', password: 'motdepasse-solide', name: 'ravive' },
  });
  const cookies = signup.headers['set-cookie'];
  const cookie = (Array.isArray(cookies) ? cookies : [cookies])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
  await app.inject({
    method: 'POST',
    url: '/api/v1/characters',
    headers: { cookie },
    payload: { name: 'Serelle', class: 'scout' },
  });
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

describe('GET /api/v1/map/regions', () => {
  it('lists the four regions with their French names', async () => {
    const cookie = await createRavive();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const items = response.json().items;
    expect(items).toHaveLength(4);
    expect(items[1]).toMatchObject({
      id: 1,
      slug: 'vellebrune-moors',
      name: 'Les Landes de Vellebrune',
      unlocked: true,
      mistLevel: 2,
    });
    expect(items[2].unlocked).toBe(false);
  });
});

describe('GET /api/v1/map/regions/:id/hexes — fog of war (US2)', () => {
  it('reveals the whole bastion to a fresh character (spawn + neighbours)', async () => {
    const cookie = await createRavive();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions/0/hexes',
      headers: { cookie },
    });
    const items = response.json().items;
    expect(items).toHaveLength(7);
    expect(items.every((h: { discovered: boolean }) => h.discovered)).toBe(true);
  });

  it('exposes only bare silhouettes at the moors border, nothing beyond', async () => {
    const cookie = await createRavive();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions/1/hexes',
      headers: { cookie },
    });
    const items = response.json().items as Array<Record<string, unknown>>;

    // adjacent to the discovered bastion: (0,0), (0,1), (0,2) — and only those
    const coords = items.map((h) => `${h['q']},${h['r']}`).sort();
    expect(coords).toEqual(['0,0', '0,1', '0,2']);

    for (const hex of items) {
      expect(hex['discovered']).toBe(false);
      expect(hex['terrain']).toBeUndefined();
      expect(hex['poi']).toBeUndefined();
      expect(hex['mistLevel']).toBeUndefined();
    }
  });

  it('returns 404 for an unknown region', async () => {
    const cookie = await createRavive();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions/9/hexes',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(404);
  });
});
