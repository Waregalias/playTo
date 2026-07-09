import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import type { Db } from '../../db/client.js';
import { characters, combats, hexes, inventory } from '../../db/schema.js';

let app: FastifyInstance;
let db: Db;
let clock: Date;
/** 0.9: no dodge/crit, variance ×1.08, no random encounters (max 40 %). */
let rngFn: () => number = () => 0.9;

const T0 = new Date('2026-07-06T12:00:00Z');

async function createRavive(klass = 'scout'): Promise<string> {
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
    payload: { name: 'Serelle', class: klass },
  });
  return cookie;
}

async function charRow() {
  const row = await db.query.characters.findFirst({ where: eq(characters.name, 'Serelle') });
  if (!row) throw new Error('No character');
  return row;
}

async function hexAt(q: number, r: number) {
  const row = await db.query.hexes.findFirst({ where: and(eq(hexes.q, q), eq(hexes.r, r)) });
  if (!row) throw new Error(`No hex at (${q},${r})`);
  return row;
}

/** Walks hex by hex, jumping the clock past each timer. */
async function walkTo(cookie: string, path: Array<[number, number]>): Promise<void> {
  const me = await charRow();
  await db
    .update(characters)
    .set({ stamina: 100, staminaUpdatedAt: clock })
    .where(eq(characters.id, me.id));
  for (const [q, r] of path) {
    const hex = await hexAt(q, r);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'move', targetHexId: hex.id },
    });
    expect(response.statusCode).toBe(201);
    const endsAt = new Date(response.json().endsAt).getTime();
    clock = new Date(endsAt + 1000);
  }
  // force la résolution du dernier pas
  await app.inject({ method: 'GET', url: '/api/v1/actions', headers: { cookie } });
}

async function beatActiveCombat(cookie: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const current = await app.inject({
      method: 'GET',
      url: '/api/v1/combat/current',
      headers: { cookie },
    });
    const combat = current.json().combat;
    if (!combat || combat.status !== 'active') return;
    await app.inject({
      method: 'POST',
      url: `/api/v1/combat/${combat.id}/turn`,
      headers: { cookie },
      payload: { action: 'attack' },
    });
  }
  throw new Error('Combat did not end in 30 turns');
}

async function questState(cookie: string, questId: string) {
  const response = await app.inject({ method: 'GET', url: '/api/v1/quests', headers: { cookie } });
  return response.json().items.find((q: { questId: string }) => q.questId === questId);
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
  rngFn = () => 0.9;
  await resetTestDb(db);
});

describe('search (US4)', () => {
  it('refuses to search outside a moorland POI (409 NOT_ON_POI)', async () => {
    const cookie = await createRavive();
    // au spawn (POI de bastion — services, pas de fouille)
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'search' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('NOT_ON_POI');
  });

  it('searches a POI once a day: loot, xp, then 409 POI_ALREADY_SEARCHED', async () => {
    const cookie = await createRavive();
    await walkTo(cookie, [
      [-1, 2],
      [0, 2],
      [1, 2],
      [2, 2], // autel du Vieux Gué (POI)
    ]);

    rngFn = () => 0.3; // herbes (50 %) tombent, verre (15 %) non ; pas de rencontre sur autel (0 %)
    const search = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'search' },
    });
    expect(search.statusCode).toBe(201);
    clock = new Date(new Date(search.json().endsAt).getTime() + 1000);
    await app.inject({ method: 'GET', url: '/api/v1/actions', headers: { cookie } });

    const me = await charRow();
    expect(me.xp).toBe(15);
    const herbs = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, me.id), eq(inventory.itemId, 'material.moor-herbs')),
    });
    expect(herbs?.qty).toBeGreaterThan(0);

    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'search' },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('POI_ALREADY_SEARCHED');
  });
});

describe('inventory (US5)', () => {
  it('equips armour, swapping the previous piece of the same kind', async () => {
    const cookie = await createRavive();
    const me = await charRow();
    const [leather] = await db
      .insert(inventory)
      .values({ characterId: me.id, itemId: 'armor.leather.t1', equipped: true })
      .returning();
    const [chain] = await db
      .insert(inventory)
      .values({ characterId: me.id, itemId: 'armor.chain.t1' })
      .returning();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/${chain!.id}/equip`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(204);

    const list = await app.inject({ method: 'GET', url: '/api/v1/inventory', headers: { cookie } });
    const items = list.json().items;
    expect(items.find((i: { id: string }) => i.id === chain!.id).equipped).toBe(true);
    expect(items.find((i: { id: string }) => i.id === leather!.id).equipped).toBe(false);
    // l'arme de départ reste équipée (kind différent)
    expect(items.find((i: { itemId: string }) => i.itemId === 'weapon.scout.t1').equipped).toBe(
      true,
    );
  });

  it('refuses a weapon of another class', async () => {
    const cookie = await createRavive('scout');
    const me = await charRow();
    const [sword] = await db
      .insert(inventory)
      .values({ characterId: me.id, itemId: 'weapon.blade.t1' })
      .returning();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/${sword!.id}/equip`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(409);
  });

  it('drinks a potion outside combat', async () => {
    const cookie = await createRavive();
    const me = await charRow();
    await db.update(characters).set({ hp: 20 }).where(eq(characters.id, me.id));
    const potion = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, me.id), eq(inventory.itemId, 'consumable.ash-potion')),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/${potion!.id}/use`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(204);
    expect((await charRow()).hp).toBe(50);
  });
});

describe('attributes (US7)', () => {
  it('allocates points and rejects over-allocation', async () => {
    const cookie = await createRavive();
    const me = await charRow();
    await db.update(characters).set({ attributePoints: 2 }).where(eq(characters.id, me.id));

    const tooMany = await app.inject({
      method: 'POST',
      url: '/api/v1/characters/me/attributes',
      headers: { cookie },
      payload: { str: 3 },
    });
    expect(tooMany.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/characters/me/attributes',
      headers: { cookie },
      payload: { str: 1, vit: 1 },
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json();
    expect(body.attributes.str).toBe(6); // scout 5 + 1
    expect(body.attributes.vit).toBe(7);
    expect(body.attributePoints).toBe(0);
    expect(body.hpMax).toBe(30 + 7 * 8);
  });
});

describe('main chain Q1→Q4 (US6 — exit criterion)', () => {
  it('plays the whole Vellebrune chain solo', async () => {
    const cookie = await createRavive('scout');

    // ── Q1 : atteindre l'autel du Vieux Gué
    let accept = await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q1/accept',
      headers: { cookie },
    });
    expect(accept.statusCode).toBe(201);
    // Q2 exige Q1 terminée
    const early = await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q2/accept',
      headers: { cookie },
    });
    expect(early.statusCode).toBe(409);
    expect(early.json().error.code).toBe('REQUIREMENT_NOT_MET');

    await walkTo(cookie, [
      [-1, 2],
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    expect((await questState(cookie, 'r1.main.q1')).state).toBe('done');
    let me = await charRow();
    expect(me.ashCrowns).toBe(10); // récompense Q1

    // ── Q2 : fouiller Vellebrune-la-Basse puis abattre un Loup de suie
    accept = await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q2/accept',
      headers: { cookie },
    });
    expect(accept.statusCode).toBe(201);

    await walkTo(cookie, [
      [3, 2],
      [4, 2], // ruines de Vellebrune-la-Basse
    ]);
    const search = await app.inject({
      method: 'POST',
      url: '/api/v1/actions',
      headers: { cookie },
      payload: { type: 'search' },
    });
    clock = new Date(new Date(search.json().endsAt).getTime() + 1000);
    await app.inject({ method: 'GET', url: '/api/v1/actions', headers: { cookie } });
    expect((await questState(cookie, 'r1.main.q2')).stepId).toBe('s2');

    // le loup de la quête (combat forcé pour un test déterministe)
    me = await charRow();
    await db.insert(combats).values({
      characterId: me.id,
      foeSlug: 'soot-wolf',
      foeHp: 34,
      foeHpMax: 34,
      playerHp: me.hp,
      log: [],
    });
    await beatActiveCombat(cookie);
    expect((await questState(cookie, 'r1.main.q2')).state).toBe('done');
    const potions = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, me.id), eq(inventory.itemId, 'consumable.ash-potion')),
    });
    expect(potions?.qty).toBe(3); // 2 de départ + 1 de Q2

    // ── Q3 : Petra, la voie de la vérité, la dispersion
    await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q3/accept',
      headers: { cookie },
    });
    await walkTo(cookie, [
      [5, 2],
      [6, 2],
      [7, 2], // cairns des bergers
    ]);
    expect((await questState(cookie, 'r1.main.q3')).stepId).toBe('s2');

    let advance = await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q3/advance',
      headers: { cookie },
      payload: { stepId: 's2', choice: 'truth' },
    });
    expect(advance.json().stepId).toBe('s3b');

    const before = await charRow();
    advance = await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q3/advance',
      headers: { cookie },
      payload: { stepId: 's3b', choice: 'disperse' },
    });
    expect(advance.json().state).toBe('done');
    me = await charRow();
    expect(me.skillPoints).toBe(before.skillPoints + 1); // le choix cruel paie

    // ── Q4 : le Chevalier Vide au Marais des Soupirs
    await app.inject({
      method: 'POST',
      url: '/api/v1/quests/r1.main.q4/accept',
      headers: { cookie },
    });
    // trop tôt : le Gardien du marais ne se montre qu'à l'étape s2, sur place
    const tooEarly = await app.inject({
      method: 'POST',
      url: '/api/v1/combat',
      headers: { cookie },
      payload: { source: 'quest', questId: 'r1.main.q4' },
    });
    expect(tooEarly.statusCode).toBe(409);

    await walkTo(cookie, [
      [6, 3],
      [5, 3],
      [4, 3], // Marais des Soupirs
    ]);
    expect((await questState(cookie, 'r1.main.q4')).stepId).toBe('s2');

    // un Ravivé aguerri pour un mini-boss de niveau 5
    me = await charRow();
    await db.update(characters).set({ str: 20, vit: 20, hp: 190 }).where(eq(characters.id, me.id));

    const boss = await app.inject({
      method: 'POST',
      url: '/api/v1/combat',
      headers: { cookie },
      payload: { source: 'quest', questId: 'r1.main.q4' },
    });
    expect(boss.statusCode).toBe(201);
    expect(boss.json().foe.slug).toBe('hollow-knight');
    await beatActiveCombat(cookie);

    expect((await questState(cookie, 'r1.main.q4')).state).toBe('done');
    const t2 = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, me.id), eq(inventory.itemId, 'weapon.scout.t2')),
    });
    expect(t2).toBeTruthy(); // l'arme t2 de SA classe

    me = await charRow();
    expect(me.level).toBeGreaterThanOrEqual(2); // l'XP de la chaîne a fait monter de niveau
    expect(me.attributePoints).toBeGreaterThanOrEqual(2);
  });
});
