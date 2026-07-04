import { sql } from 'drizzle-orm';
import { createDb } from '../client.js';
import { regions, hexes } from '../schema.js';
import { REGION_SEEDS, HEX_SEEDS } from './world-data.js';

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

  const [{ count }] = (await db.execute(
    sql`SELECT count(*)::int AS count FROM hexes`,
  )) as unknown as [{ count: number }];

  console.log(`Seed complete: ${REGION_SEEDS.length} regions, ${count} hexes.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
