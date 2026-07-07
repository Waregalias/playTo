import { z } from 'zod';
import { characterSchema } from './character.js';

export const createListingSchema = z.object({
  itemId: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
});

export const buyListingSchema = z.object({ qty: z.number().int().positive() });

export const listingSchema = z.object({
  id: z.uuid(),
  sellerId: z.uuid(),
  sellerName: z.string(),
  itemId: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  at: z.iso.datetime(),
});

/** Paginated market listings (`GET /market/listings` — mirrors the chat history shape). */
export const listingsPageSchema = z.object({
  items: z.array(listingSchema),
  nextCursor: z.string().nullable(),
});

/** `POST /market/listings/:id/buy` — updated buyer + what was purchased. */
export const buyListingResponseSchema = z.object({
  character: characterSchema,
  purchased: z.object({
    itemId: z.string(),
    qty: z.number().int().positive(),
    totalPaid: z.number().int().nonnegative(),
  }),
});

/** `DELETE /market/listings/:id` — the cancelled listing's id. */
export const cancelListingResponseSchema = z.object({ id: z.uuid() });

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type BuyListingInput = z.infer<typeof buyListingSchema>;
export type ListingDto = z.infer<typeof listingSchema>;
export type ListingsPageDto = z.infer<typeof listingsPageSchema>;
export type BuyListingResponse = z.infer<typeof buyListingResponseSchema>;
export type CancelListingResponse = z.infer<typeof cancelListingResponseSchema>;
