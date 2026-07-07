import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters } from '../../db/schema.js';
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

function learn(cookie: string, skillId: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/characters/me/skills',
    headers: { cookie },
    payload: { skillId },
  });
}

function equip(cookie: string, body: { slot1?: string | null; slot2?: string | null }) {
  return app.inject({
    method: 'PUT',
    url: '/api/v1/characters/me/skills/equipped',
    headers: { cookie },
    payload: body,
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

describe('POST /api/v1/characters/me/skills', () => {
  it('learns a skill, spending a skill point', async () => {
    const cookie = await signUp('sk1@aldenfer.test');
    const char = await makeChar(cookie, 'Learner');
    await db.update(characters).set({ skillPoints: 2 }).where(eq(characters.id, char.id));

    const res = await learn(cookie, 'blade.bulwark.1');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skillPoints).toBe(1);
    expect(body.skills.map((s: { skillId: string }) => s.skillId)).toContain('blade.bulwark.1');
  });

  it('rejects learning without a skill point (409 REQUIREMENT_NOT_MET)', async () => {
    const cookie = await signUp('sk2@aldenfer.test');
    await makeChar(cookie, 'Pointless');
    const res = await learn(cookie, 'blade.bulwark.1');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REQUIREMENT_NOT_MET');
  });

  it('rejects a tier-2 skill without its tier-1 prerequisite', async () => {
    const cookie = await signUp('sk3@aldenfer.test');
    const char = await makeChar(cookie, 'Skipper');
    await db.update(characters).set({ skillPoints: 5 }).where(eq(characters.id, char.id));
    const res = await learn(cookie, 'blade.bulwark.2');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REQUIREMENT_NOT_MET');
  });

  it('rejects an already-known skill (409 SKILL_ALREADY_LEARNED)', async () => {
    const cookie = await signUp('sk4@aldenfer.test');
    const char = await makeChar(cookie, 'Repeater');
    await db.update(characters).set({ skillPoints: 2 }).where(eq(characters.id, char.id));
    const res = await learn(cookie, 'blade.steel.1'); // starter, already learned
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SKILL_ALREADY_LEARNED');
  });

  it('requires ember fragments for a tier-4 skill', async () => {
    const cookie = await signUp('sk5@aldenfer.test');
    const char = await makeChar(cookie, 'Deep');
    await db
      .update(characters)
      .set({
        skillPoints: 5,
        learnedSkills: ['blade.steel.1', 'blade.bulwark.1', 'blade.bulwark.2', 'blade.bulwark.3'],
      })
      .where(eq(characters.id, char.id));

    const denied = await learn(cookie, 'blade.bulwark.4');
    expect(denied.statusCode).toBe(409);
    expect(denied.json().error.code).toBe('REQUIREMENT_NOT_MET');

    await db.update(characters).set({ emberFragments: 3 }).where(eq(characters.id, char.id));
    const ok = await learn(cookie, 'blade.bulwark.4');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().currencies.emberFragments).toBe(2); // 3 − 1
  });
});

describe('PUT /api/v1/characters/me/skills/equipped', () => {
  it('equips a learned active into slot 2', async () => {
    const cookie = await signUp('sk6@aldenfer.test');
    const char = await makeChar(cookie, 'Equipper');
    await db
      .update(characters)
      .set({ skillPoints: 5, learnedSkills: ['blade.steel.1', 'blade.steel.2'] })
      .where(eq(characters.id, char.id));

    const res = await equip(cookie, { slot1: 'blade.steel.1', slot2: 'blade.steel.2' });
    expect(res.statusCode).toBe(200);
    const skills = res.json().skills as Array<{ skillId: string; equippedSlot: number | null }>;
    expect(skills.find((s) => s.skillId === 'blade.steel.2')!.equippedSlot).toBe(2);
  });

  it('rejects equipping an unlearned or passive skill (409 REQUIREMENT_NOT_MET)', async () => {
    const cookie = await signUp('sk7@aldenfer.test');
    const char = await makeChar(cookie, 'BadEquip');
    await db
      .update(characters)
      .set({ learnedSkills: ['blade.steel.1', 'blade.bulwark.1'] })
      .where(eq(characters.id, char.id));
    // bulwark.1 is a passive → not equippable
    const res = await equip(cookie, { slot2: 'blade.bulwark.1' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REQUIREMENT_NOT_MET');
  });

  it('unequips a slot with null', async () => {
    const cookie = await signUp('sk8@aldenfer.test');
    await makeChar(cookie, 'Unequip'); // starts with blade.steel.1 in slot1
    const res = await equip(cookie, { slot1: null });
    expect(res.statusCode).toBe(200);
    const skills = res.json().skills as Array<{ skillId: string; equippedSlot: number | null }>;
    expect(skills.find((s) => s.skillId === 'blade.steel.1')!.equippedSlot).toBeNull();
  });
});
