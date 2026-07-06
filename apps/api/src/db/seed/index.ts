import { sql } from 'drizzle-orm';
import { createDb } from '../client.js';
import { regions, hexes, items, quests } from '../schema.js';
import { REGION_SEEDS, HEX_SEEDS } from './world-data.js';
import { ITEM_SEEDS } from './items-data.js';
import { QUEST_SEEDS } from './quests-data.js';

const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgres://aldenfer:aldenfer@localhost:5432/aldenfer';

async function seed() {
  const db = createDb(databaseUrl);

  await db
    .insert(regions)
    .values(REGION_SEEDS)
    .onConflictDoUpdate({
      target: regions.id,
      set: {
        slug: sql`excluded.slug`,
        unlocked: sql`excluded.unlocked`,
        mistLevel: sql`excluded.mist_level`,
        emberLit: sql`excluded.ember_lit`,
      },
    });

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
    .onConflictDoUpdate({
      target: [hexes.q, hexes.r],
      set: {
        regionId: sql`excluded.region_id`,
        terrain: sql`excluded.terrain`,
        poiType: sql`excluded.poi_type`,
      },
    });

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
    .onConflictDoUpdate({
      target: items.id,
      set: {
        kind: sql`excluded.kind`,
        rarity: sql`excluded.rarity`,
        stats: sql`excluded.stats`,
        stackable: sql`excluded.stackable`,
      },
    });

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
    .onConflictDoUpdate({
      target: quests.id,
      set: {
        regionId: sql`excluded.region_id`,
        kind: sql`excluded.kind`,
        steps: sql`excluded.steps`,
        rewards: sql`excluded.rewards`,
        requires: sql`excluded.requires`,
      },
    });

  const [{ count }] = (await db.execute(
    sql`SELECT count(*)::int AS count FROM hexes`,
  )) as unknown as [{ count: number }];

  console.log(
    `Seed complete: ${REGION_SEEDS.length} regions, ${count} hexes, ` +
      `${ITEM_SEEDS.length} items, ${QUEST_SEEDS.length} quests.`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
