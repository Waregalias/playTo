import { eq } from 'drizzle-orm';
import { effectiveMistLevel, isAdjacent, type HexDto, type RegionDto } from '@aldenfer/shared';
import { REGION_NAMES_FR } from '@aldenfer/shared/content/fr';
import type { Db } from '../../db/client.js';
import { discoveries, hexes, regions } from '../../db/schema.js';

export async function listRegions(db: Db): Promise<RegionDto[]> {
  const rows = await db.select().from(regions).orderBy(regions.id);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: REGION_NAMES_FR[r.slug] ?? r.slug,
    unlocked: r.unlocked,
    mistLevel: r.mistLevel as RegionDto['mistLevel'],
    emberLit: r.emberLit,
  }));
}

/**
 * Fog of war (US2): discovered hexes carry full data; undiscovered hexes
 * adjacent to any discovered one appear as bare silhouettes; everything
 * else stays hidden. Adjacency is evaluated on the global grid, so border
 * silhouettes show up across regions.
 */
export async function listRegionHexes(
  db: Db,
  characterId: string,
  regionId: number,
): Promise<HexDto[] | null> {
  const region = await db.query.regions.findFirst({ where: eq(regions.id, regionId) });
  if (!region) return null;

  const discoveredRows = await db
    .select({ q: hexes.q, r: hexes.r, hexId: hexes.id })
    .from(discoveries)
    .innerJoin(hexes, eq(discoveries.hexId, hexes.id))
    .where(eq(discoveries.characterId, characterId));

  const discoveredIds = new Set(discoveredRows.map((d) => d.hexId));
  const discoveredCoords = discoveredRows.map((d) => ({ q: d.q, r: d.r }));

  const regionHexes = await db.select().from(hexes).where(eq(hexes.regionId, regionId));

  const items: HexDto[] = [];
  for (const hex of regionHexes) {
    if (discoveredIds.has(hex.id)) {
      items.push({
        id: hex.id,
        q: hex.q,
        r: hex.r,
        discovered: true,
        terrain: hex.terrain,
        mistLevel: effectiveMistLevel(region.mistLevel, hex.mistDelta),
        poi: hex.poiType ? { type: hex.poiType, searchedToday: false } : null,
      });
    } else if (discoveredCoords.some((c) => isAdjacent(c, { q: hex.q, r: hex.r }))) {
      items.push({ id: hex.id, q: hex.q, r: hex.r, discovered: false });
    }
  }
  return items;
}
