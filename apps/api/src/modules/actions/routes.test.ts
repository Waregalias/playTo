import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import type { Db } from '../../db/client.js';
import { characters, hexes, regions } from '../../db/schema.js';
import { resolveAction } from './service.js';

let app: FastifyInstance;
let db: Db;

/** Simulated clock — tests advance it by reassigning. */
let clock: Date;
const T0 = new Date('2026-07-05T12:00:00Z');

async function createRavive(email = 'ravive@aldenfer.test'): Promise<string> {
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: 'motdepasse-solide', name: 'ravive' },
  });
  const cookies = signup.headers['set-cookie'];
  const cookie = (Array.isArray(cookies) ? cookies : [cookies])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/characters',
    headers: { cookie },
    payload: { name: 'Serelle', class: 'blade' },
  });
  expect(created.statusCode).toBe(201);
  return cookie;
}

async function hexAt(q: number, r: number) {
  const row = await db.query.hexes.findFirst({ where: and(eq(hexes.q, q), eq(hexes.r, r)) });
  if (!row) throw new Error(`No hex at (${q},${r})`);
  return row;
}

async function myStamina(cookie: string): Promise<number> {
  const me = await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });
  return me.json().stamina;
}

beforeAll(async () => {
  db = await setupTestDb();
  app = await buildApp(TEST_ENV, { db, now: () => clock });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  clock = T0;
  await resetTestDb(db);
});

describe('POST /api/v1/actions — move (US3)', () => {
  it('debits stamina and schedules the timer from terrain costs', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2); // ash_road, region 0, mist 0 → 3⚡, 60 s

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });

    expect(response.statusCode).toBe(201);
    const action = response.json();
    expect(action.position).toBe(0);
    expect(action.startsAt).toBe(T0.toISOString());
    expect(action.endsAt).toBe(new Date(T0.getTime() + 60_000).toISOString());
    expect(await myStamina(cookie)).toBe(97);
  });

  it('applies the mist multiplier of the target region (×1.5 at level 2)', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2);
    const moorsRoad = await hexAt(0, 2); // ash_road, region 1, mist 2 → ceil(3×1.5)=5⚡, 90 s

    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: moorsRoad.id },
    });

    expect(response.statusCode).toBe(201);
    const action = response.json();
    expect(action.position).toBe(1);
    // chained: starts when the first move ends, lasts 90 s
    expect(action.startsAt).toBe(new Date(T0.getTime() + 60_000).toISOString());
    expect(action.endsAt).toBe(new Date(T0.getTime() + 150_000).toISOString());
    expect(await myStamina(cookie)).toBe(100 - 3 - 5);
  });

  it('rejects a non-adjacent target (409 NOT_ADJACENT)', async () => {
    const cookie = await createRavive();
    const farHex = await hexAt(2, 2);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: farHex.id },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('NOT_ADJACENT');
  });

  it('rejects when stamina is too low (409 INSUFFICIENT_STAMINA)', async () => {
    const cookie = await createRavive();
    await db
      .update(characters)
      .set({ stamina: 1, staminaUpdatedAt: clock })
      .where(eq(characters.name, 'Serelle'));

    const westGate = await hexAt(-1, 2);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });
    expect(response.statusCode).toBe(409);
    const error = response.json().error;
    expect(error.code).toBe('INSUFFICIENT_STAMINA');
    expect(error.details).toEqual({ required: 3, current: 1 });
  });

  it('rejects a fourth queued action (409 QUEUE_FULL)', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2);
    const spawn = await hexAt(-2, 2);

    for (const target of [westGate, spawn, westGate]) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/actions',
        headers: { cookie },
        payload: { type: 'move', targetHexId: target.id },
      });
      expect(r.statusCode).toBe(201);
    }
    const fourth = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: spawn.id },
    });
    expect(fourth.statusCode).toBe(409);
    expect(fourth.json().error.code).toBe('QUEUE_FULL');
  });

  it('rejects a move into a locked region (409 HEX_LOCKED)', async () => {
    const cookie = await createRavive();
    await db.update(regions).set({ unlocked: false }).where(eq(regions.id, 1));
    try {
      const westGate = await hexAt(-1, 2);
      await app.inject({
        method: 'POST',
        url: '/api/v1/actions',
        headers: { cookie },
        payload: { type: 'move', targetHexId: westGate.id },
      });
      const moorsRoad = await hexAt(0, 2);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions',
        headers: { cookie },
        payload: { type: 'move', targetHexId: moorsRoad.id },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('HEX_LOCKED');
    } finally {
      await db.update(regions).set({ unlocked: true }).where(eq(regions.id, 1));
    }
  });
});

describe('resolution (US3) & idempotence', () => {
  it('moves the character and reveals neighbours once the timer elapses', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2);
    const moorsRoad = await hexAt(0, 2);

    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: moorsRoad.id },
    });

    clock = new Date(T0.getTime() + 151_000); // both moves elapsed

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/characters/me',
      headers: { cookie },
    });
    expect(me.json().hexId).toBe(moorsRoad.id);
    expect(me.json().regionId).toBe(1);

    const queue = await app.inject({ method: 'GET', url: '/api/v1/actions', headers: { cookie } });
    expect(queue.json().items).toEqual([]);

    const map = await app.inject({
      method: 'GET',
      url: '/api/v1/map/regions/1/hexes',
      headers: { cookie },
    });
    const road = map.json().items.find((h: { id: string }) => h.id === moorsRoad.id);
    expect(road.discovered).toBe(true);
    expect(road.terrain).toBe('ash_road');
  });

  it('never applies an action twice (UPDATE … WHERE resolved = false)', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });
    const actionId = created.json().id;

    clock = new Date(T0.getTime() + 61_000);
    expect(await resolveAction(db, actionId, clock)).toBe(true);
    expect(await resolveAction(db, actionId, clock)).toBe(false);
  });
});

describe('DELETE /api/v1/actions/:id (US4)', () => {
  it('cancels a queued action and refunds its stamina', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2);
    const spawn = await hexAt(-2, 2);

    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: spawn.id },
    });
    // west gate = ash_road (3⚡), back to spawn = shrine (5⚡)
    expect(await myStamina(cookie)).toBe(100 - 3 - 5);

    const cancel = await app.inject({
      method: 'DELETE',
      url: `/api/v1/actions/${second.json().id}`,
      headers: { cookie },
    });
    expect(cancel.statusCode).toBe(204);
    expect(await myStamina(cookie)).toBe(97);
  });

  it('refuses to cancel the running action (409 ACTION_ALREADY_STARTED)', async () => {
    const cookie = await createRavive();
    const westGate = await hexAt(-1, 2);
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: westGate.id },
    });

    const cancel = await app.inject({
      method: 'DELETE',
      url: `/api/v1/actions/${first.json().id}`,
      headers: { cookie },
    });
    expect(cancel.statusCode).toBe(409);
    expect(cancel.json().error.code).toBe('ACTION_ALREADY_STARTED');
  });
});

describe('rest (US5)', () => {
  it('grants +75 stamina (plus passive regen) after 30 min on a shrine', async () => {
    const cookie = await createRavive();
    await db
      .update(characters)
      .set({ stamina: 10, staminaUpdatedAt: clock })
      .where(eq(characters.name, 'Serelle'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'rest' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().endsAt).toBe(new Date(T0.getTime() + 1_800_000).toISOString());

    clock = new Date(T0.getTime() + 1_800_000);
    // bastion regen ×2 → +10 passive over 30 min, then +75 from the rest
    expect(await myStamina(cookie)).toBe(10 + 10 + 75);
  });

  it('caps rest at 100 stamina', async () => {
    const cookie = await createRavive();
    await db
      .update(characters)
      .set({ stamina: 60, staminaUpdatedAt: clock })
      .where(eq(characters.name, 'Serelle'));

    await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'rest' },
    });
    clock = new Date(T0.getTime() + 1_800_000);
    expect(await myStamina(cookie)).toBe(100);
  });

  it('refuses to rest away from a shrine (409 NOT_ON_SHRINE)', async () => {
    const cookie = await createRavive();
    const market = await hexAt(-3, 2); // plain
    await db.update(characters).set({ hexId: market.id }).where(eq(characters.name, 'Serelle'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'rest' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('NOT_ON_SHRINE');
  });
});
