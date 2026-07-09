import { and, desc, eq, lt } from 'drizzle-orm';
import {
  marketTax,
  type CharacterDto,
  type CreateListingInput,
  type ListingDto,
  type ListingsPageDto,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters, hexes, marketListings } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { addItem, inventoryCapacity, removeSellableQty } from '../inventory/service.js';
import { toCharacterDto } from '../characters/service.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type CharacterRow = typeof characters.$inferSelect;
type ListingRow = typeof marketListings.$inferSelect;

const PAGE = 50;

function toListingDto(row: ListingRow, sellerName: string): ListingDto {
  return {
    id: row.id,
    sellerId: row.sellerId,
    sellerName,
    itemId: row.itemId,
    qty: row.qty,
    unitPrice: row.unitPrice,
    at: row.createdAt.toISOString(),
  };
}

export async function listListings(
  db: Db,
  itemId?: string,
  cursor?: string,
): Promise<ListingsPageDto> {
  const filters = [
    itemId ? eq(marketListings.itemId, itemId) : undefined,
    cursor ? lt(marketListings.createdAt, new Date(cursor)) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({ listing: marketListings, sellerName: characters.name })
    .from(marketListings)
    .innerJoin(characters, eq(marketListings.sellerId, characters.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(marketListings.createdAt))
    .limit(PAGE);

  const items = rows.map((r) => toListingDto(r.listing, r.sellerName));
  const nextCursor = items.length === PAGE ? items[items.length - 1]!.at : null;
  return { items, nextCursor };
}

export async function createListing(
  db: Db,
  seller: CharacterRow,
  input: CreateListingInput,
): Promise<ListingDto> {
  return db.transaction(async (tx) => {
    const removed = await removeSellableQty(tx, seller.id, input.itemId, input.qty);
    if (!removed) throw new AppError('INSUFFICIENT_MATERIALS', 409);
    const [row] = await tx
      .insert(marketListings)
      .values({
        sellerId: seller.id,
        itemId: input.itemId,
        qty: input.qty,
        unitPrice: input.unitPrice,
      })
      .returning();
    if (!row) throw new Error('listing insert returned no row');
    return toListingDto(row, seller.name);
  });
}

export async function buyListing(
  db: Db,
  buyer: CharacterRow,
  listingId: string,
  qty: number,
  now: Date,
): Promise<{
  character: CharacterDto;
  purchased: { itemId: string; qty: number; totalPaid: number };
}> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(marketListings)
      .where(eq(marketListings.id, listingId))
      .for('update');
    if (!listing) throw new AppError('LISTING_UNAVAILABLE', 409);
    if (listing.sellerId === buyer.id) throw new AppError('CANNOT_BUY_OWN_LISTING', 409);
    if (listing.qty < qty) throw new AppError('LISTING_UNAVAILABLE', 409);

    const gross = qty * listing.unitPrice;

    const [buyerRow] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, buyer.id))
      .for('update');
    if (!buyerRow) throw new Error('buyer vanished mid-transaction');
    if (buyerRow.ashCrowns < gross) throw new AppError('INSUFFICIENT_FUNDS', 409);

    const added = await addItem(tx, buyer.id, listing.itemId, qty, inventoryCapacity(buyerRow.str));
    if (added.lost > 0) throw new AppError('INVENTORY_FULL', 409);

    // Buyer pays the gross; seller nets gross − tax; the tax vanishes (sink).
    await tx
      .update(characters)
      .set({ ashCrowns: buyerRow.ashCrowns - gross })
      .where(eq(characters.id, buyer.id));
    const [sellerRow] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, listing.sellerId))
      .for('update');
    if (!sellerRow) throw new Error('seller vanished mid-transaction');
    await tx
      .update(characters)
      .set({ ashCrowns: sellerRow.ashCrowns + (gross - marketTax(gross)) })
      .where(eq(characters.id, listing.sellerId));

    if (listing.qty === qty) {
      await tx.delete(marketListings).where(eq(marketListings.id, listing.id));
    } else {
      await tx
        .update(marketListings)
        .set({ qty: listing.qty - qty })
        .where(eq(marketListings.id, listing.id));
    }

    const [freshBuyer] = await tx.select().from(characters).where(eq(characters.id, buyer.id));
    const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, freshBuyer!.hexId) });
    return {
      character: toCharacterDto(freshBuyer!, hex!, now),
      purchased: { itemId: listing.itemId, qty, totalPaid: gross },
    };
  });
}

export async function cancelListing(
  db: Db,
  character: CharacterRow,
  listingId: string,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(marketListings)
      .where(eq(marketListings.id, listingId))
      .for('update');
    if (!listing) throw new AppError('LISTING_UNAVAILABLE', 409);
    if (listing.sellerId !== character.id) throw new AppError('FORBIDDEN', 403);

    const added = await addItem(
      tx,
      character.id,
      listing.itemId,
      listing.qty,
      inventoryCapacity(character.str),
    );
    if (added.lost > 0) throw new AppError('INVENTORY_FULL', 409);
    await tx.delete(marketListings).where(eq(marketListings.id, listing.id));
    return { id: listing.id };
  });
}
