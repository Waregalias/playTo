import { and, eq } from 'drizzle-orm';
import {
  INVENTORY_BASE_CAPACITY,
  itemStatsSchema,
  deriveGearStats,
  repairCost,
  itemTierFromId,
  DEATH_PENALTY,
  type ItemStats,
  type InventoryEntryDto,
  type RepairResponse,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters, hexes, inventory, items } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { toCharacterDto } from '../characters/service.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type InventoryRow = typeof inventory.$inferSelect;
type ItemRow = typeof items.$inferSelect;
type CharacterRow = typeof characters.$inferSelect;

export function toEntryDto(entry: InventoryRow, item: ItemRow): InventoryEntryDto {
  return {
    id: entry.id,
    itemId: entry.itemId,
    kind: item.kind as InventoryEntryDto['kind'],
    rarity: item.rarity,
    qty: entry.qty,
    equipped: entry.equipped,
    stats: item.stats ? itemStatsSchema.parse(item.stats) : null,
    durability: entry.durability,
    maxDurability: item.maxDurability,
  };
}

export function inventoryCapacity(str: number): number {
  return INVENTORY_BASE_CAPACITY + str;
}

/** One slot per inventory row — stackables share their row (GDD §9.2). */
export async function usedSlots(tx: Tx | Db, characterId: string): Promise<number> {
  const rows = await tx
    .select({ id: inventory.id })
    .from(inventory)
    .where(eq(inventory.characterId, characterId));
  return rows.length;
}

export interface AddItemResult {
  added: number;
  /** Quantity dropped because the bag was full. */
  lost: number;
}

/**
 * Adds an item, stacking when possible, respecting slot capacity.
 * Call inside the transaction of whatever grants the item.
 */
export async function addItem(
  tx: Tx,
  characterId: string,
  itemId: string,
  qty: number,
  capacity: number,
): Promise<AddItemResult> {
  const item = await tx.query.items.findFirst({ where: eq(items.id, itemId) });
  if (!item) throw new Error(`Unknown item ${itemId}`);

  if (item.stackable) {
    const existing = await tx.query.inventory.findFirst({
      where: and(eq(inventory.characterId, characterId), eq(inventory.itemId, itemId)),
    });
    if (existing) {
      await tx
        .update(inventory)
        .set({ qty: existing.qty + qty })
        .where(eq(inventory.id, existing.id));
      return { added: qty, lost: 0 };
    }
  }

  const slots = await usedSlots(tx, characterId);
  if (item.stackable) {
    if (slots >= capacity) return { added: 0, lost: qty };
    await tx.insert(inventory).values({ characterId, itemId, qty });
    return { added: qty, lost: 0 };
  }

  // Non-stackable: one row per unit. Gear starts at full durability (SPEC-M3 décision 2).
  let added = 0;
  for (let i = 0; i < qty; i++) {
    if (slots + added >= capacity) break;
    await tx
      .insert(inventory)
      .values({ characterId, itemId, qty: 1, durability: item.maxDurability ?? undefined });
    added += 1;
  }
  return { added, lost: qty - added };
}

/**
 * Death toll: 25 % of every stackable material stack, floored (SPEC-M2).
 * `lossReductionPct` (Poche double, scout.shadow.1) shrinks that ratio.
 */
export async function loseMaterialsOnDeath(
  tx: Tx,
  characterId: string,
  lossReductionPct = 0,
): Promise<void> {
  const ratio = DEATH_PENALTY.materialLossRatio * (1 - lossReductionPct / 100);
  const rows = await tx
    .select({ entry: inventory, kind: items.kind })
    .from(inventory)
    .innerJoin(items, eq(inventory.itemId, items.id))
    .where(eq(inventory.characterId, characterId));

  for (const { entry, kind } of rows) {
    if (kind !== 'material') continue;
    const lost = Math.floor(entry.qty * ratio);
    if (lost <= 0) continue;
    if (lost >= entry.qty) {
      await tx.delete(inventory).where(eq(inventory.id, entry.id));
    } else {
      await tx
        .update(inventory)
        .set({ qty: entry.qty - lost })
        .where(eq(inventory.id, entry.id));
    }
  }
}

export interface EquippedGear {
  weaponPower: number;
  damageKind: 'physical' | 'arcane';
  armor: number;
}

/** Aggregates equipped weapon & armour stats for the combat formulas. */
export async function equippedGear(tx: Tx | Db, characterId: string): Promise<EquippedGear> {
  const rows = await tx
    .select({
      entry: inventory,
      kind: items.kind,
      stats: items.stats,
      maxDurability: items.maxDurability,
    })
    .from(inventory)
    .innerJoin(items, eq(inventory.itemId, items.id))
    .where(and(eq(inventory.characterId, characterId), eq(inventory.equipped, true)));

  const gear: EquippedGear = { weaponPower: 0, damageKind: 'physical', armor: 0 };
  for (const row of rows) {
    const parsed: ItemStats = row.stats ? itemStatsSchema.parse(row.stats) : {};
    const stats = deriveGearStats(parsed, row.entry.durability, row.maxDurability);
    if (row.kind === 'weapon') {
      gear.weaponPower = stats.power ?? 0;
      gear.damageKind = stats.damageKind ?? 'physical';
    } else if (row.kind === 'armor') {
      gear.armor += stats.armor ?? 0;
    }
  }
  return gear;
}

export function toInventoryRow(row: InventoryRow): InventoryRow {
  return row;
}

/**
 * Debits `qty` of an item across the character's non-equipped rows (stackable or not).
 * Returns false and changes nothing if the total available is short. For the market.
 */
export async function removeSellableQty(
  tx: Tx,
  characterId: string,
  itemId: string,
  qty: number,
): Promise<boolean> {
  const rows = await tx
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.characterId, characterId),
        eq(inventory.itemId, itemId),
        eq(inventory.equipped, false),
      ),
    );
  const total = rows.reduce((sum, r) => sum + r.qty, 0);
  if (total < qty) return false;
  let need = qty;
  for (const row of rows) {
    if (need <= 0) break;
    const take = Math.min(need, row.qty);
    if (take === row.qty) {
      await tx.delete(inventory).where(eq(inventory.id, row.id));
    } else {
      await tx
        .update(inventory)
        .set({ qty: row.qty - take })
        .where(eq(inventory.id, row.id));
    }
    need -= take;
  }
  return true;
}

/** Debits `qty` of a stackable material; returns false (no change) if the stack is too small. */
export async function removeMaterialQty(
  tx: Tx,
  characterId: string,
  itemId: string,
  qty: number,
): Promise<boolean> {
  const row = await tx.query.inventory.findFirst({
    where: and(eq(inventory.characterId, characterId), eq(inventory.itemId, itemId)),
  });
  if (!row || row.qty < qty) return false;
  if (row.qty === qty) {
    await tx.delete(inventory).where(eq(inventory.id, row.id));
  } else {
    await tx
      .update(inventory)
      .set({ qty: row.qty - qty })
      .where(eq(inventory.id, row.id));
  }
  return true;
}

/** Restores a damaged weapon/armour to full durability for écus (US7). */
export async function repairEntry(
  db: Db,
  character: CharacterRow,
  entryId: string,
  now: Date,
): Promise<RepairResponse> {
  return db.transaction(async (tx) => {
    const found = await tx
      .select({ entry: inventory, item: items })
      .from(inventory)
      .innerJoin(items, eq(inventory.itemId, items.id))
      .where(and(eq(inventory.id, entryId), eq(inventory.characterId, character.id)));
    const row = found[0];
    if (!row) throw new AppError('NOT_FOUND', 404);
    if (row.item.maxDurability === null) throw new AppError('REQUIREMENT_NOT_MET', 409);

    const current = row.entry.durability ?? row.item.maxDurability;
    const missing = row.item.maxDurability - current;
    if (missing <= 0) throw new AppError('NOTHING_TO_REPAIR', 409);

    const cost = repairCost(missing, itemTierFromId(row.item.id));
    const [charRow] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, character.id))
      .for('update');
    if (!charRow) throw new Error('character vanished mid-transaction');
    if (charRow.ashCrowns < cost) throw new AppError('INSUFFICIENT_FUNDS', 409);

    await tx
      .update(characters)
      .set({ ashCrowns: charRow.ashCrowns - cost })
      .where(eq(characters.id, character.id));
    const [updatedEntry] = await tx
      .update(inventory)
      .set({ durability: row.item.maxDurability })
      .where(eq(inventory.id, entryId))
      .returning();

    const [freshChar] = await tx.select().from(characters).where(eq(characters.id, character.id));
    const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, freshChar!.hexId) });
    return {
      character: toCharacterDto(freshChar!, hex!, now),
      entry: toEntryDto(updatedEntry!, row.item),
    };
  });
}
