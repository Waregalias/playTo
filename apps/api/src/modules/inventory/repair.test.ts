import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters, inventory } from '../../db/schema.js';
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

async function makeChar(cookie: string, name: string) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/characters',
    headers: { cookie },
    payload: { name, class: 'blade' },
  });
  return (await db.query.characters.findFirst({ where: eq(characters.name, name) }))!;
}

async function starterWeaponEntry(characterId: string) {
  return (await db.query.inventory.findFirst({
    where: and(eq(inventory.characterId, characterId), eq(inventory.equipped, true)),
  }))!;
}

function repair(cookie: string, entryId: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/inventory/repair',
    headers: { cookie },
    payload: { entryId },
  });
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

describe('POST /api/v1/inventory/repair', () => {
  it('restores durability to max, debiting the écu cost', async () => {
    const cookie = await signUp('rep1@aldenfer.test');
    const char = await makeChar(cookie, 'Fixer');
    await db.update(characters).set({ ashCrowns: 100 }).where(eq(characters.id, char.id));
    const weapon = await starterWeaponEntry(char.id);
    await db.update(inventory).set({ durability: 60 }).where(eq(inventory.id, weapon.id));

    const res = await repair(cookie, weapon.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.entry.durability).toBe(100);
    expect(body.character.currencies.ashCrowns).toBe(60); // 100 − repairCost(40, t1)=40
  });

  it('rejects repairing a full-durability item (409 NOTHING_TO_REPAIR)', async () => {
    const cookie = await signUp('rep2@aldenfer.test');
    const char = await makeChar(cookie, 'AlreadyFine');
    const weapon = await starterWeaponEntry(char.id);

    const res = await repair(cookie, weapon.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('NOTHING_TO_REPAIR');
  });

  it('rejects when écus are too few (409 INSUFFICIENT_FUNDS)', async () => {
    const cookie = await signUp('rep3@aldenfer.test');
    const char = await makeChar(cookie, 'Broke');
    const weapon = await starterWeaponEntry(char.id);
    await db.update(inventory).set({ durability: 10 }).where(eq(inventory.id, weapon.id));

    const res = await repair(cookie, weapon.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects a non-gear entry (409 REQUIREMENT_NOT_MET)', async () => {
    const cookie = await signUp('rep4@aldenfer.test');
    const char = await makeChar(cookie, 'Potioneer');
    const potion = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, char.id), eq(inventory.itemId, 'consumable.ash-potion')),
    });
    const res = await repair(cookie, potion!.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REQUIREMENT_NOT_MET');
  });

  it('rejects repairing another character’s entry (404 NOT_FOUND)', async () => {
    const ownerCookie = await signUp('rep5o@aldenfer.test');
    const owner = await makeChar(ownerCookie, 'Owner');
    const weapon = await starterWeaponEntry(owner.id);
    await db.update(inventory).set({ durability: 10 }).where(eq(inventory.id, weapon.id));

    const intruderCookie = await signUp('rep5i@aldenfer.test');
    await makeChar(intruderCookie, 'Intruder');
    const res = await repair(intruderCookie, weapon.id);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
