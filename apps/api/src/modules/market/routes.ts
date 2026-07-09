import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  buyListingResponseSchema,
  buyListingSchema,
  cancelListingResponseSchema,
  createListingSchema,
  listingSchema,
  listingsPageSchema,
} from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { listListings, createListing, buyListing, cancelListing } from './service.js';

export function registerMarketRoutes(app: FastifyInstance, auth: Auth, now: () => Date): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/market/listings',
    {
      schema: {
        querystring: z.object({ itemId: z.string().optional(), cursor: z.string().optional() }),
        response: { 200: listingsPageSchema },
      },
    },
    async (request) => {
      await requireCharacter(app.db, auth, request);
      return listListings(app.db, request.query.itemId, request.query.cursor);
    },
  );

  typed.post(
    '/api/v1/market/listings',
    { schema: { body: createListingSchema, response: { 200: listingSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return createListing(app.db, character, request.body);
    },
  );

  typed.post(
    '/api/v1/market/listings/:id/buy',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: buyListingSchema,
        response: { 200: buyListingResponseSchema },
      },
    },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return buyListing(app.db, character, request.params.id, request.body.qty, now());
    },
  );

  typed.delete(
    '/api/v1/market/listings/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: cancelListingResponseSchema },
      },
    },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return cancelListing(app.db, character, request.params.id);
    },
  );
}
