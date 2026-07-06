import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { createDb, type Db } from '../db/client.js';
import { regions, hexes, items, quests } from '../db/schema.js';
import { REGION_SEEDS, HEX_SEEDS } from '../db/seed/world-data.js';
import { ITEM_SEEDS } from '../db/seed/items-data.js';
import { QUEST_SEEDS } from '../db/seed/quests-data.js';
import type { Env } from '../env.js';

const ADMIN_URL = 'postgres://aldenfer:aldenfer@localhost:5432/postgres';
const TEST_DB = 'aldenfer_test';
export const TEST_DATABASE_URL = `postgres://aldenfer:aldenfer@localhost:5432/${TEST_DB}`;

export const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: 'test-secret-32-characters-minimum!',
  BETTER_AUTH_URL: 'http://localhost:3000',
  WEB_ORIGIN: ['http://localhost:4200'],
};

/** Creates (if needed), migrates and seeds the dedicated test database. */
export async function setupTestDb(): Promise<Db> {
  const admin = postgres(ADMIN_URL, { max: 1 });
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}`;
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE ${TEST_DB}`);
  }
  await admin.end();

  const db = createDb(TEST_DATABASE_URL);
  await migrate(db, { migrationsFolder: './src/db/migrations' });

  await db.insert(regions).values(REGION_SEEDS).onConflictDoNothing();
  await db
    .insert(hexes)
    .values(
      HEX_SEEDS.map((h) => ({
        regionId: h.regionId,
        q: h.q,
        r: h.r,
        terrain: h.terrain,
        poiType: h.poiType ?? null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(items)
    .values(
      ITEM_SEEDS.map((i) => ({
        id: i.id,
        kind: i.kind,
        rarity: i.rarity,
        stats: i.stats ?? null,
        stackable: i.stackable,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(quests)
    .values(
      QUEST_SEEDS.map((q) => ({
        id: q.id,
        regionId: q.regionId,
        kind: q.kind,
        steps: q.steps,
        rewards: q.rewards,
        requires: q.requires ?? null,
      })),
    )
    .onConflictDoNothing();

  return db;
}

/** Wipes mutable state between tests; world & content data stay. */
export async function resetTestDb(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE action_queue, discoveries, combats, inventory, character_quests,
        poi_searches, characters, session, account, verification, "user" CASCADE`,
  );
}
