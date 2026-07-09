import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters, combats, hexes, inventory } from '../../db/schema.js';
import type { Db } from '../../db/client.js';

let app: FastifyInstance;
let db: Db;
let clock: Date;
let rngFn: () => number = () => 0.55;
const T0 = new Date('2026-07-06T12:00:00Z');

async function signUp(email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: 'motdepasse-solide', name: email.split('@')[0] },
  });
  const cookies = response.headers['set-cookie'];
  return (Array.isArray(cookies) ? cookies : [cookies])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

async function makeChar(cookie: string, name: string, learnedSkills: string[]) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/characters',
    headers: { cookie },
    payload: { name, class: 'blade' },
  });
  const row = (await db.query.characters.findFirst({ where: eq(characters.name, name) }))!;
  await db
    .update(characters)
    .set({ learnedSkills: ['blade.steel.1', ...learnedSkills] })
    .where(eq(characters.id, row.id));
  return (await db.query.characters.findFirst({ where: eq(characters.id, row.id) }))!;
}

async function hexAt(q: number, r: number) {
  return (await db.query.hexes.findFirst({ where: and(eq(hexes.q, q), eq(hexes.r, r)) }))!;
}

function move(cookie: string, targetHexId: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/actions',
    headers: { cookie },
    payload: { type: 'move', targetHexId },
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  app = await buildApp(TEST_ENV, { db, now: () => clock, rng: () => rngFn() });
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  clock = T0;
  rngFn = () => 0.55;
  await resetTestDb(db);
});

describe('Pas léger (scout.travel.1) — move timer', () => {
  it('shortens the move duration by 10 %', async () => {
    const cookie = await signUp('ef1@aldenfer.test');
    await makeChar(cookie, 'Swift', ['scout.travel.1']);
    const westGate = await hexAt(-1, 2); // ash_road, 60 s base

    const res = await move(cookie, westGate.id);
    expect(res.statusCode).toBe(201);
    // round(60 × 0.9) = 54 s
    expect(res.json().endsAt).toBe(new Date(T0.getTime() + 54_000).toISOString());
  });
});

describe('Longue-Vue (scout.travel.2) — vision', () => {
  it('reveals hexes two steps away on arrival', async () => {
    const cookie = await signUp('ef2@aldenfer.test');
    await makeChar(cookie, 'Farsight', ['scout.travel.2']); // visionBonus 1
    const westGate = await hexAt(-1, 2);
    const moorsRoad = await hexAt(0, 2);

    await move(cookie, westGate.id);
    await move(cookie, moorsRoad.id);
    clock = new Date(T0.getTime() + 200_000); // both moves elapsed

    await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });
    const map = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions/1/hexes',
      headers: { cookie },
    });
    // (2,2) is two steps from (0,2): only visible with +1 vision
    const shrine = map.json().items.find((h: { q: number; r: number }) => h.q === 2 && h.r === 2);
    expect(shrine.discovered).toBe(true);
  });

  it('does not reveal two-step hexes without the skill', async () => {
    const cookie = await signUp('ef3@aldenfer.test');
    await makeChar(cookie, 'Nearsight', []);
    const westGate = await hexAt(-1, 2);
    const moorsRoad = await hexAt(0, 2);

    await move(cookie, westGate.id);
    await move(cookie, moorsRoad.id);
    clock = new Date(T0.getTime() + 200_000);

    await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });
    const map = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions/1/hexes',
      headers: { cookie },
    });
    const shrine = map.json().items.find((h: { q: number; r: number }) => h.q === 2 && h.r === 2);
    expect(shrine.discovered).toBe(false);
  });
});

describe('Lecture des runes (arcanist.scholar.1) — search loot', () => {
  it('boosts the loot chance so a find lands where it otherwise would not', async () => {
    const cookie = await signUp('ef4@aldenfer.test');
    const char = await makeChar(cookie, 'Reader', ['arcanist.scholar.1']); // searchLootPct 20
    const shrineHex = await hexAt(2, 2); // old-ford-shrine: moor-herbs chance 0.5
    await db.update(characters).set({ hexId: shrineHex.id }).where(eq(characters.id, char.id));

    // rng 0.55: base 0.5 misses, boosted 0.6 hits.
    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'search' },
    });
    clock = new Date(T0.getTime() + 30 * 60_000);
    await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });

    const herbs = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, char.id), eq(inventory.itemId, 'material.moor-herbs')),
    });
    expect(herbs?.qty).toBe(2);
  });

  it('finds nothing at the same roll without the skill', async () => {
    const cookie = await signUp('ef5@aldenfer.test');
    const char = await makeChar(cookie, 'Plain', []);
    const shrineHex = await hexAt(2, 2);
    await db.update(characters).set({ hexId: shrineHex.id }).where(eq(characters.id, char.id));

    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'search' },
    });
    clock = new Date(T0.getTime() + 30 * 60_000);
    await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });

    const herbs = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, char.id), eq(inventory.itemId, 'material.moor-herbs')),
    });
    expect(herbs).toBeUndefined();
  });
});

describe('Poche double (scout.shadow.1) — death material loss', () => {
  it('halves the material toll on death', async () => {
    rngFn = () => 0.5;
    const cookie = await signUp('ef6@aldenfer.test');
    const char = await makeChar(cookie, 'Hoarder', ['scout.shadow.1']); // deathMaterialLossPct 50
    await db.update(characters).set({ hp: 5 }).where(eq(characters.id, char.id));
    await db
      .insert(inventory)
      .values({ characterId: char.id, itemId: 'material.mistborn-hide', qty: 8 });

    const [combat] = await db
      .insert(combats)
      .values({
        characterId: char.id,
        foeSlug: 'soot-wolf',
        foeHp: 34,
        foeHpMax: 34,
        playerHp: 5,
        log: [],
      })
      .returning();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/combat/${combat!.id}/turn`,
      headers: { cookie },
      payload: { action: 'attack' },
    });
    expect(res.json().status).toBe('lost');

    const hides = await db.query.inventory.findFirst({
      where: and(
        eq(inventory.characterId, char.id),
        eq(inventory.itemId, 'material.mistborn-hide'),
      ),
    });
    expect(hides?.qty).toBe(7); // 8 − floor(8 × 0.25 × 0.5) = 8 − 1
  });
});
