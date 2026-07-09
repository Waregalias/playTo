import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import {
  inventoryResponseSchema,
  itemStatsSchema,
  maxHp,
  allocateAttributesSchema,
  characterSchema,
  repairSchema,
  repairResponseSchema,
} from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { characters, inventory, items } from '../../db/schema.js';
import { requireCharacter } from '../../lib/require-character.js';
import { AppError } from '../../lib/app-error.js';
import { getMyCharacter } from '../characters/service.js';
import { getActiveCombat } from '../combat/service.js';
import { inventoryCapacity, usedSlots, repairEntry, toEntryDto } from './service.js';

export function registerInventoryRoutes(app: FastifyInstance, auth: Auth, now: () => Date): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/inventory',
    { schema: { response: { 200: inventoryResponseSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      const rows = await app.db
        .select({ entry: inventory, item: items })
        .from(inventory)
        .innerJoin(items, eq(inventory.itemId, items.id))
        .where(eq(inventory.characterId, character.id));

      return {
        items: rows.map(({ entry, item }) => toEntryDto(entry, item)),
        capacity: inventoryCapacity(character.str),
        used: rows.length,
      };
    },
  );

  typed.post(
    '/api/v1/inventory/:entryId/equip',
    { schema: { params: z.object({ entryId: z.uuid() }) } },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      await app.db.transaction(async (tx) => {
        const found = await tx
          .select({ entry: inventory, item: items })
          .from(inventory)
          .innerJoin(items, eq(inventory.itemId, items.id))
          .where(
            and(eq(inventory.id, request.params.entryId), eq(inventory.characterId, character.id)),
          );
        const row = found[0];
        if (!row) throw new AppError('NOT_FOUND', 404);
        if (row.item.kind !== 'weapon' && row.item.kind !== 'armor') {
          throw new AppError('REQUIREMENT_NOT_MET', 409);
        }
        const stats = row.item.stats ? itemStatsSchema.parse(row.item.stats) : {};
        if (stats.classRestriction && stats.classRestriction !== character.class) {
          throw new AppError('REQUIREMENT_NOT_MET', 409);
        }

        // One weapon, one armour: unequip anything of the same kind first.
        const equippedRows = await tx
          .select({ entry: inventory, item: items })
          .from(inventory)
          .innerJoin(items, eq(inventory.itemId, items.id))
          .where(and(eq(inventory.characterId, character.id), eq(inventory.equipped, true)));
        for (const other of equippedRows) {
          if (other.item.kind === row.item.kind) {
            await tx
              .update(inventory)
              .set({ equipped: false })
              .where(eq(inventory.id, other.entry.id));
          }
        }
        await tx.update(inventory).set({ equipped: true }).where(eq(inventory.id, row.entry.id));
      });
      return reply.status(204).send();
    },
  );

  typed.post(
    '/api/v1/inventory/:entryId/unequip',
    { schema: { params: z.object({ entryId: z.uuid() }) } },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      const [row] = await app.db
        .update(inventory)
        .set({ equipped: false })
        .where(
          and(eq(inventory.id, request.params.entryId), eq(inventory.characterId, character.id)),
        )
        .returning();
      if (!row) throw new AppError('NOT_FOUND', 404);
      return reply.status(204).send();
    },
  );

  // Consumables outside combat (in combat, the item IS the turn).
  typed.post(
    '/api/v1/inventory/:entryId/use',
    { schema: { params: z.object({ entryId: z.uuid() }) } },
    async (request, reply) => {
      const character = await requireCharacter(app.db, auth, request);
      await app.db.transaction(async (tx) => {
        if (await getActiveCombat(tx, character.id)) {
          throw new AppError('COMBAT_ALREADY_ACTIVE', 409);
        }
        const found = await tx
          .select({ entry: inventory, item: items })
          .from(inventory)
          .innerJoin(items, eq(inventory.itemId, items.id))
          .where(
            and(eq(inventory.id, request.params.entryId), eq(inventory.characterId, character.id)),
          );
        const row = found[0];
        if (!row) throw new AppError('NOT_FOUND', 404);
        const stats = row.item.stats ? itemStatsSchema.parse(row.item.stats) : {};
        if (row.item.kind !== 'consumable' || !stats.heal) {
          throw new AppError('REQUIREMENT_NOT_MET', 409);
        }

        await tx
          .update(characters)
          .set({ hp: Math.min(maxHp(character.vit), character.hp + stats.heal) })
          .where(eq(characters.id, character.id));
        if (row.entry.qty > 1) {
          await tx
            .update(inventory)
            .set({ qty: row.entry.qty - 1 })
            .where(eq(inventory.id, row.entry.id));
        } else {
          await tx.delete(inventory).where(eq(inventory.id, row.entry.id));
        }
      });
      return reply.status(204).send();
    },
  );

  // Attribute allocation (US7)
  typed.post(
    '/api/v1/characters/me/attributes',
    { schema: { body: allocateAttributesSchema, response: { 200: characterSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      const body = request.body;
      const total = body.str + body.dex + body.wil + body.vit + body.fer;
      if (total > character.attributePoints) {
        throw new AppError('VALIDATION_ERROR', 400, {
          available: character.attributePoints,
          requested: total,
        });
      }
      await app.db
        .update(characters)
        .set({
          str: character.str + body.str,
          dex: character.dex + body.dex,
          wil: character.wil + body.wil,
          vit: character.vit + body.vit,
          fer: character.fer + body.fer,
          attributePoints: character.attributePoints - total,
        })
        .where(eq(characters.id, character.id));

      const dto = await getMyCharacter(app.db, character.userId, now());
      if (!dto) throw new AppError('NOT_FOUND', 404);
      return dto;
    },
  );

  // Repair (US7): restore a damaged weapon/armour to full durability for écus.
  typed.post(
    '/api/v1/inventory/repair',
    { schema: { body: repairSchema, response: { 200: repairResponseSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return repairEntry(app.db, character, request.body.entryId, now());
    },
  );
}
