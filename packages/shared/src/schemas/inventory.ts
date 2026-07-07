import { z } from 'zod';
import { characterSchema } from './character.js';

export const itemKindSchema = z.enum(['weapon', 'armor', 'consumable', 'material', 'quest']);
export const raritySchema = z.enum(['common', 'rare', 'ember', 'relic']);

/** Static item stats (JSONB in the items table — validated before write). */
export const itemStatsSchema = z.object({
  /** Weapon attack bonus. */
  power: z.number().int().positive().optional(),
  /** 'physical' (STR-scaled) or 'arcane' (WIL-scaled) weapon. */
  damageKind: z.enum(['physical', 'arcane']).optional(),
  /** Class allowed to equip the weapon. */
  classRestriction: z.enum(['blade', 'arcanist', 'scout', 'cantor']).optional(),
  /** Armour mitigation. */
  armor: z.number().int().positive().optional(),
  /** Consumable heal amount. */
  heal: z.number().int().positive().optional(),
});

export const inventoryEntrySchema = z.object({
  id: z.uuid(),
  itemId: z.string(),
  kind: itemKindSchema,
  rarity: raritySchema,
  qty: z.number().int().positive(),
  equipped: z.boolean(),
  stats: itemStatsSchema.nullish(),
  durability: z.number().int().min(0).nullable(),
  maxDurability: z.number().int().positive().nullable(),
});

export const inventoryResponseSchema = z.object({
  items: z.array(inventoryEntrySchema),
  capacity: z.number().int().positive(),
  used: z.number().int().min(0),
});

/** Attribute allocation (API-SPEC §3, US7). */
export const allocateAttributesSchema = z
  .object({
    str: z.number().int().min(0).default(0),
    dex: z.number().int().min(0).default(0),
    wil: z.number().int().min(0).default(0),
    vit: z.number().int().min(0).default(0),
    fer: z.number().int().min(0).default(0),
  })
  .refine((a) => a.str + a.dex + a.wil + a.vit + a.fer > 0, {
    message: 'At least one point must be allocated',
  });

/** `POST /inventory/repair` (US7). */
export const repairSchema = z.object({ entryId: z.uuid() });
export const repairResponseSchema = z.object({
  character: characterSchema,
  entry: inventoryEntrySchema,
});

export type ItemStats = z.infer<typeof itemStatsSchema>;
export type InventoryEntryDto = z.infer<typeof inventoryEntrySchema>;
export type AllocateAttributesInput = z.infer<typeof allocateAttributesSchema>;
export type RepairInput = z.infer<typeof repairSchema>;
export type RepairResponse = z.infer<typeof repairResponseSchema>;
