import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import type { Db } from '../../db/client.js';
import { characters, combats, hexes, inventory, actionQueue } from '../../db/schema.js';

let app: FastifyInstance;
let db: Db;
let clock: Date;
/** Controlled randomness: 0.5 → variance ×1.0, no dodge, no crit. */
let rngFn: () => number = () => 0.5;

const T0 = new Date('2026-07-06T12:00:00Z');

async function createRavive(klass = 'blade', email = 'ravive@aldenfer.test'): Promise<string> {
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
    payload: { name: 'Serelle', class: klass },
  });
  expect(created.statusCode).toBe(201);
  return cookie;
}

async function charRow() {
  const row = await db.query.characters.findFirst({ where: eq(characters.name, 'Serelle') });
  if (!row) throw new Error('No character');
  return row;
}

/** Puts a soot-wolf in front of the character (bypasses the encounter roll). */
async function forceCombat(cookie: string): Promise<string> {
  const me = await charRow();
  const [row] = await db
    .insert(combats)
    .values({
      characterId: me.id,
      foeSlug: 'soot-wolf',
      foeHp: 34,
      foeHpMax: 34,
      playerHp: me.hp,
      log: [],
    })
    .returning();
  return row!.id;
}

async function turn(cookie: string, combatId: string, payload: object) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/combat/${combatId}/turn`,
    headers: { cookie },
    payload,
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
  rngFn = () => 0.5;
  await resetTestDb(db);
});

describe('combat turns (US2)', () => {
  it('wins a deterministic fight against a soot-wolf and collects rewards', async () => {
    const cookie = await createRavive('blade');
    const combatId = await forceCombat(cookie);

    // blade: STR 8×2 + arme 6 = 22 vs armure 4 → 20 dmg/tour ; loup : 34 PV
    const first = await turn(cookie, combatId, { action: 'attack' });
    expect(first.statusCode).toBe(200);
    const s1 = first.json();
    expect(s1.foe.hp).toBe(14);
    expect(s1.status).toBe('active');
    // riposte : 11 dmg (armure 0)
    expect(s1.playerHp).toBe(102 - 11);

    const second = await turn(cookie, combatId, { action: 'attack' });
    const s2 = second.json();
    expect(s2.status).toBe('won');
    expect(s2.foe.hp).toBe(0);
    expect(s2.rewards.xp).toBe(25);
    expect(s2.rewards.ashCrowns).toBe(7); // 4 + floor(0.5 × 6)
    expect(s2.rewards.loot).toEqual([{ itemId: 'material.mistborn-hide', qty: 1 }]);

    const me = await charRow();
    expect(me.xp).toBe(25);
    expect(me.ashCrowns).toBe(7);
  });

  it('uses the starter skill with its ×1.3 multiplier and cooldown', async () => {
    const cookie = await createRavive('blade');
    const combatId = await forceCombat(cookie);

    const first = await turn(cookie, combatId, { action: 'skill', skillId: 'blade.steel.1' });
    const s1 = first.json();
    // 22 × 1.3 × (1 − 4/54) = 26.49 → 26
    expect(34 - s1.foe.hp).toBe(26);
    expect(s1.cooldowns['blade.steel.1']).toBeGreaterThan(0);

    // still cooling down → refused
    const second = await turn(cookie, combatId, { action: 'skill', skillId: 'blade.steel.1' });
    expect(second.statusCode).toBe(409);
  });

  it('heals with a potion as the turn action', async () => {
    const cookie = await createRavive('blade');
    const me = await charRow();
    await db.update(characters).set({ hp: 40 }).where(eq(characters.id, me.id));
    const combatId = await forceCombat(cookie);

    const result = await turn(cookie, combatId, { action: 'item', itemId: 'consumable.ash-potion' });
    const state = result.json();
    // +30 PV puis riposte 11
    expect(state.playerHp).toBe(40 + 30 - 11);

    const potion = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, me.id), eq(inventory.itemId, 'consumable.ash-potion')),
    });
    expect(potion?.qty).toBe(1);
  });

  it('flees successfully when DEX favours the scout', async () => {
    const cookie = await createRavive('scout'); // DEX 9 vs 7 → 56 % > 0.5
    const combatId = await forceCombat(cookie);
    const result = await turn(cookie, combatId, { action: 'flee' });
    const state = result.json();
    expect(state.status).toBe('fled');
    expect(state.rewards).toBeFalsy();
  });

  it('blocks new intentions while a Mistborn waits (409 COMBAT_ALREADY_ACTIVE)', async () => {
    const cookie = await createRavive('blade');
    await forceCombat(cookie);
    const gate = await db.query.hexes.findFirst({
      where: and(eq(hexes.q, -1), eq(hexes.r, 2)),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: gate!.id },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('COMBAT_ALREADY_ACTIVE');
  });
});

describe('death & respawn (US3)', () => {
  it('respawns at the Ember Hall with the 2 h penalty and material loss', async () => {
    const cookie = await createRavive('blade');
    const me = await charRow();
    // au bord de la mort, avec 8 cuirs et une file d'actions
    await db.update(characters).set({ hp: 5 }).where(eq(characters.id, me.id));
    await db.insert(inventory).values({
      characterId: me.id,
      itemId: 'material.mistborn-hide',
      qty: 8,
    });
    const combatId = await forceCombat(cookie);

    const result = await turn(cookie, combatId, { action: 'attack' });
    const state = result.json();
    expect(state.status).toBe('lost'); // riposte 11 > 5 PV

    const after = await charRow();
    expect(after.hp).toBe(51); // 102 × 0.5
    expect(after.deathPenaltyUntil).toEqual(new Date(T0.getTime() + 2 * 3_600_000));
    const spawn = await db.query.hexes.findFirst({ where: eq(hexes.poiType, 'ember-hall') });
    expect(after.hexId).toBe(spawn!.id);

    const hides = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, me.id), eq(inventory.itemId, 'material.mistborn-hide')),
    });
    expect(hides?.qty).toBe(6); // 8 − floor(8 × 0.25)
  });

  it('applies the −20 % penalty to combat damage', async () => {
    const cookie = await createRavive('blade');
    const me = await charRow();
    await db
      .update(characters)
      .set({ deathPenaltyUntil: new Date(T0.getTime() + 3_600_000) })
      .where(eq(characters.id, me.id));
    const combatId = await forceCombat(cookie);

    const result = await turn(cookie, combatId, { action: 'attack' });
    // STR 8 → 6 (floor 8×0.8) : (12 + 6) × (1 − 4/54) = 16.67 → 17
    expect(34 - result.json().foe.hp).toBe(17);
  });
});

describe('encounters on resolution (US1)', () => {
  it('rolls a Mistborn when moving onto moorland terrain', async () => {
    const cookie = await createRavive('scout');
    // chemin : porte de l'ouest → route (0,2) → plaine (0,1)
    for (const [q, r] of [
      [-1, 2],
      [0, 2],
      [0, 1],
    ]) {
      const hex = await db.query.hexes.findFirst({ where: and(eq(hexes.q, q!), eq(hexes.r, r!)) });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions',
        headers: { cookie },
        payload: { type: 'move', targetHexId: hex!.id },
      });
      expect(response.statusCode).toBe(201);
    }

    // rencontre garantie à la résolution (rng 0.01 < 15 % plaine)
    rngFn = () => 0.01;
    clock = new Date(T0.getTime() + 3_600_000);

    const me = await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });
    expect(me.json().activeCombatId).toBeTruthy();

    const current = await app.inject({ method: 'GET', url: '/api/v1/combat/current', headers: { cookie } });
    expect(current.json().combat.foe.slug).toBe('soot-wolf');
    // le combat a coûté 15 ⚡ en plus des déplacements
    const row = await charRow();
    const queue = await db
      .select()
      .from(actionQueue)
      .where(and(eq(actionQueue.characterId, row.id), eq(actionQueue.resolved, false)));
    expect(queue).toHaveLength(0);
  });

  it('never rolls encounters on ash roads or in the bastion', async () => {
    const cookie = await createRavive('scout');
    rngFn = () => 0.001; // toute probabilité > 0 déclencherait
    for (const [q, r] of [
      [-1, 2], // porte de l'ouest (bastion)
      [0, 2], // route de cendre (0 %)
    ]) {
      const hex = await db.query.hexes.findFirst({ where: and(eq(hexes.q, q!), eq(hexes.r, r!)) });
      await app.inject({
        method: 'POST',
        url: '/api/v1/actions',
        headers: { cookie },
        payload: { type: 'move', targetHexId: hex!.id },
      });
    }
    clock = new Date(T0.getTime() + 3_600_000);
    const me = await app.inject({ method: 'GET', url: '/api/v1/characters/me', headers: { cookie } });
    expect(me.json().activeCombatId).toBeFalsy();
  });
});
