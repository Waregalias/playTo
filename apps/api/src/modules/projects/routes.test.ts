import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters, inventory, projects, characterQuests } from '../../db/schema.js';
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

async function giveMaterial(characterId: string, itemId: string, qty: number) {
  await db.insert(inventory).values({ characterId, itemId, qty });
}

function contribute(cookie: string, resource: string, qty: number) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/projects/r1.belfry/contribute',
    headers: { cookie },
    payload: { resource, qty },
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
  await db
    .update(projects)
    .set({ progress: {}, completedAt: null })
    .where(eq(projects.id, 'r1.belfry'));
});

describe('POST /api/v1/projects/:id/contribute', () => {
  it('debits materials, credits progress, XP, écus and 5 stamina', async () => {
    const cookie = await signUp('c1@aldenfer.test');
    const char = await makeChar(cookie, 'Giver');
    await giveMaterial(char.id, 'material.shadewood', 100);

    const res = await contribute(cookie, 'shadewood', 50);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project.progress.shadewood).toBe(50);
    expect(body.project.myContribution.shadewood).toBe(50);
    expect(body.character.stamina).toBe(95);
    const inv = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, char.id), eq(inventory.itemId, 'material.shadewood')),
    });
    expect(inv!.qty).toBe(50);
  });

  it('clamps to the remaining goal and debits only what is needed', async () => {
    const cookie = await signUp('c2@aldenfer.test');
    const char = await makeChar(cookie, 'Clamper');
    await db
      .update(projects)
      .set({ progress: { shadewood: 4990 } })
      .where(eq(projects.id, 'r1.belfry'));
    await giveMaterial(char.id, 'material.shadewood', 100);

    const res = await contribute(cookie, 'shadewood', 100);
    expect(res.json().project.progress.shadewood).toBe(5000);
    const inv = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, char.id), eq(inventory.itemId, 'material.shadewood')),
    });
    expect(inv!.qty).toBe(90); // only 10 debited
  });

  it('rejects when the material is missing (409 INSUFFICIENT_MATERIALS)', async () => {
    const cookie = await signUp('c3@aldenfer.test');
    await makeChar(cookie, 'Empty');
    const res = await contribute(cookie, 'shadewood', 10);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_MATERIALS');
  });

  it('rejects when stamina is below 5 (409 INSUFFICIENT_STAMINA)', async () => {
    const cookie = await signUp('c4@aldenfer.test');
    const char = await makeChar(cookie, 'Tired');
    await db
      .update(characters)
      .set({ stamina: 4, staminaUpdatedAt: NOW })
      .where(eq(characters.id, char.id));
    await giveMaterial(char.id, 'material.shadewood', 10);
    const res = await contribute(cookie, 'shadewood', 10);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_STAMINA');
  });

  it('completes the belfry: Q5 done for the contributor + announce', async () => {
    const cookie = await signUp('c5@aldenfer.test');
    const char = await makeChar(cookie, 'Finisher');
    await db
      .update(projects)
      .set({ progress: { shadewood: 5000, sootOre: 3000, ashGlass: 499 } })
      .where(eq(projects.id, 'r1.belfry'));
    await giveMaterial(char.id, 'material.ash-glass', 1);
    await db.insert(characterQuests).values({
      characterId: char.id,
      questId: 'r1.main.q5',
      state: 'active',
      stepId: 's1',
      progress: { counts: {}, choices: {} },
    });

    const publishSpy = vi.spyOn(app.realtime, 'publish');
    const res = await contribute(cookie, 'ashGlass', 1);
    expect(res.statusCode).toBe(200);
    expect(res.json().project.completedAt).not.toBeNull();

    const cq = await db.query.characterQuests.findFirst({
      where: eq(characterQuests.characterId, char.id),
    });
    expect(cq!.state).toBe('done');
    expect(publishSpy.mock.calls.some((c) => c[0] === 'global' && c[1] === 'announce')).toBe(true);
    publishSpy.mockRestore();
  });

  it('rejects contributing to a completed project (409 PROJECT_COMPLETED)', async () => {
    const cookie = await signUp('c6@aldenfer.test');
    const char = await makeChar(cookie, 'Late');
    await db.update(projects).set({ completedAt: NOW }).where(eq(projects.id, 'r1.belfry'));
    await giveMaterial(char.id, 'material.shadewood', 10);
    const res = await contribute(cookie, 'shadewood', 10);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROJECT_COMPLETED');
  });
});
