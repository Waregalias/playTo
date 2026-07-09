import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters, inventory, marketListings } from '../../db/schema.js';
import type { Db } from '../../db/client.js';
import type { CreateListingInput } from '@aldenfer/shared';

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

async function giveCrowns(characterId: string, ashCrowns: number) {
  await db.update(characters).set({ ashCrowns }).where(eq(characters.id, characterId));
}

function createListing(cookie: string, body: CreateListingInput) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/market/listings',
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

describe('POST /api/v1/market/listings', () => {
  it('removes the items from the seller and lists them', async () => {
    const cookie = await signUp('m1@aldenfer.test');
    const seller = await makeChar(cookie, 'Seller');
    await giveMaterial(seller.id, 'material.shadewood', 100);

    const res = await createListing(cookie, {
      itemId: 'material.shadewood',
      qty: 40,
      unitPrice: 10,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().qty).toBe(40);

    const inv = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, seller.id), eq(inventory.itemId, 'material.shadewood')),
    });
    expect(inv!.qty).toBe(60);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/market/listings?itemId=material.shadewood',
      headers: { cookie },
    });
    expect(list.json().items).toHaveLength(1);
    expect(list.json().items[0].sellerName).toBe('Seller');
  });

  it('rejects listing items the seller lacks (409 INSUFFICIENT_MATERIALS)', async () => {
    const cookie = await signUp('m2@aldenfer.test');
    await makeChar(cookie, 'Broke');
    const res = await createListing(cookie, {
      itemId: 'material.shadewood',
      qty: 10,
      unitPrice: 5,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_MATERIALS');
  });
});

describe('POST /api/v1/market/listings/:id/buy', () => {
  it('transfers items, applies the 5% tax, decrements the stack (partial buy)', async () => {
    const sellerCookie = await signUp('m3s@aldenfer.test');
    const seller = await makeChar(sellerCookie, 'Merchant');
    await giveMaterial(seller.id, 'material.shadewood', 100);
    await createListing(sellerCookie, { itemId: 'material.shadewood', qty: 100, unitPrice: 10 });
    const listing = (await db.query.marketListings.findFirst())!;

    const buyerCookie = await signUp('m3b@aldenfer.test');
    const buyer = await makeChar(buyerCookie, 'Buyer');
    await giveCrowns(buyer.id, 1000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/market/listings/${listing.id}/buy`,
      headers: { cookie: buyerCookie },
      payload: { qty: 40 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.purchased).toEqual({ itemId: 'material.shadewood', qty: 40, totalPaid: 400 });
    // buyer paid 400 gross
    expect(body.character.currencies.ashCrowns).toBe(600);

    // seller netted 400 - 5% = 380
    const freshSeller = await db.query.characters.findFirst({
      where: eq(characters.id, seller.id),
    });
    expect(freshSeller!.ashCrowns).toBe(380);

    // listing decremented to 60
    const freshListing = await db.query.marketListings.findFirst({
      where: eq(marketListings.id, listing.id),
    });
    expect(freshListing!.qty).toBe(60);

    // buyer received 40
    const inv = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, buyer.id), eq(inventory.itemId, 'material.shadewood')),
    });
    expect(inv!.qty).toBe(40);
  });

  it('deletes the listing when fully bought', async () => {
    const sellerCookie = await signUp('m4s@aldenfer.test');
    const seller = await makeChar(sellerCookie, 'FullSeller');
    await giveMaterial(seller.id, 'material.shadewood', 20);
    await createListing(sellerCookie, { itemId: 'material.shadewood', qty: 20, unitPrice: 5 });
    const listing = (await db.query.marketListings.findFirst())!;

    const buyerCookie = await signUp('m4b@aldenfer.test');
    const buyer = await makeChar(buyerCookie, 'FullBuyer');
    await giveCrowns(buyer.id, 1000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/market/listings/${listing.id}/buy`,
      headers: { cookie: buyerCookie },
      payload: { qty: 20 },
    });
    expect(res.statusCode).toBe(200);
    const gone = await db.query.marketListings.findFirst({
      where: eq(marketListings.id, listing.id),
    });
    expect(gone).toBeUndefined();
  });

  it('rejects buying your own listing (409 CANNOT_BUY_OWN_LISTING)', async () => {
    const cookie = await signUp('m5@aldenfer.test');
    const seller = await makeChar(cookie, 'SelfBuyer');
    await giveMaterial(seller.id, 'material.shadewood', 10);
    await giveCrowns(seller.id, 1000);
    await createListing(cookie, { itemId: 'material.shadewood', qty: 10, unitPrice: 5 });
    const listing = (await db.query.marketListings.findFirst())!;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/market/listings/${listing.id}/buy`,
      headers: { cookie },
      payload: { qty: 5 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CANNOT_BUY_OWN_LISTING');
  });

  it('rejects buying with too few écus (409 INSUFFICIENT_FUNDS)', async () => {
    const sellerCookie = await signUp('m6s@aldenfer.test');
    const seller = await makeChar(sellerCookie, 'PriceySeller');
    await giveMaterial(seller.id, 'material.shadewood', 10);
    await createListing(sellerCookie, { itemId: 'material.shadewood', qty: 10, unitPrice: 100 });
    const listing = (await db.query.marketListings.findFirst())!;

    const buyerCookie = await signUp('m6b@aldenfer.test');
    const buyer = await makeChar(buyerCookie, 'PoorBuyer');
    await giveCrowns(buyer.id, 50);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/market/listings/${listing.id}/buy`,
      headers: { cookie: buyerCookie },
      payload: { qty: 10 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects buying more than available (409 LISTING_UNAVAILABLE)', async () => {
    const sellerCookie = await signUp('m7s@aldenfer.test');
    const seller = await makeChar(sellerCookie, 'ThinSeller');
    await giveMaterial(seller.id, 'material.shadewood', 5);
    await createListing(sellerCookie, { itemId: 'material.shadewood', qty: 5, unitPrice: 5 });
    const listing = (await db.query.marketListings.findFirst())!;

    const buyerCookie = await signUp('m7b@aldenfer.test');
    const buyer = await makeChar(buyerCookie, 'GreedyBuyer');
    await giveCrowns(buyer.id, 1000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/market/listings/${listing.id}/buy`,
      headers: { cookie: buyerCookie },
      payload: { qty: 10 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LISTING_UNAVAILABLE');
  });
});

describe('DELETE /api/v1/market/listings/:id', () => {
  it('returns the items to the seller and deletes the listing', async () => {
    const cookie = await signUp('m8@aldenfer.test');
    const seller = await makeChar(cookie, 'Canceller');
    await giveMaterial(seller.id, 'material.shadewood', 30);
    await createListing(cookie, { itemId: 'material.shadewood', qty: 30, unitPrice: 5 });
    const listing = (await db.query.marketListings.findFirst())!;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/market/listings/${listing.id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(listing.id);

    const gone = await db.query.marketListings.findFirst({
      where: eq(marketListings.id, listing.id),
    });
    expect(gone).toBeUndefined();
    const inv = await db.query.inventory.findFirst({
      where: and(eq(inventory.characterId, seller.id), eq(inventory.itemId, 'material.shadewood')),
    });
    expect(inv!.qty).toBe(30);
  });

  it('rejects cancelling another seller’s listing (403 FORBIDDEN)', async () => {
    const sellerCookie = await signUp('m9s@aldenfer.test');
    const seller = await makeChar(sellerCookie, 'RealSeller');
    await giveMaterial(seller.id, 'material.shadewood', 10);
    await createListing(sellerCookie, { itemId: 'material.shadewood', qty: 10, unitPrice: 5 });
    const listing = (await db.query.marketListings.findFirst())!;

    const intruderCookie = await signUp('m9i@aldenfer.test');
    await makeChar(intruderCookie, 'Intruder');
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/market/listings/${listing.id}`,
      headers: { cookie: intruderCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});
