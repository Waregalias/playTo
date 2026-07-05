import { and, asc, eq, lte } from 'drizzle-orm';
import {
  ACTION_QUEUE_MAX,
  REST_ACTION,
  STAMINA_MAX,
  computeStamina,
  effectiveMistLevel,
  isAdjacent,
  moveCost,
  neighbours,
  movePayloadSchema,
  restPayloadSchema,
  moveResultSchema,
  restResultSchema,
  type ActionDto,
  type CreateActionInput,
  type MistLevel,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { actionQueue, characters, discoveries, hexes, regions } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { regenContextFor } from '../characters/service.js';

type ActionRow = typeof actionQueue.$inferSelect;
type CharacterRow = typeof characters.$inferSelect;
type HexRow = typeof hexes.$inferSelect;

// Drizzle's transaction callback parameter shares the Db query interface.
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function toActionDto(row: ActionRow): ActionDto {
  return {
    id: row.id,
    type: row.type as ActionDto['type'],
    payload: row.payload as Record<string, unknown>,
    position: row.position,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    resolved: row.resolved,
  };
}

async function unresolvedQueue(tx: Tx | Db, characterId: string): Promise<ActionRow[]> {
  return tx
    .select()
    .from(actionQueue)
    .where(and(eq(actionQueue.characterId, characterId), eq(actionQueue.resolved, false)))
    .orderBy(asc(actionQueue.position));
}

/** Inserts hex + its on-map neighbours into the character's discoveries. */
async function discoverAround(tx: Tx, characterId: string, hex: HexRow): Promise<string[]> {
  const coords = [{ q: hex.q, r: hex.r }, ...neighbours({ q: hex.q, r: hex.r })];
  const found: HexRow[] = [];
  for (const c of coords) {
    const row = await tx.query.hexes.findFirst({
      where: and(eq(hexes.q, c.q), eq(hexes.r, c.r)),
    });
    if (row) found.push(row);
  }
  if (found.length > 0) {
    await tx
      .insert(discoveries)
      .values(found.map((h) => ({ characterId, hexId: h.id })))
      .onConflictDoNothing();
  }
  return found.map((h) => h.id);
}

/**
 * Resolves one due action. Idempotent: the UPDATE … WHERE resolved = false
 * RETURNING claim guarantees each action applies its effects exactly once,
 * whether triggered by a read (lazy resolution) or by the worker.
 */
export async function resolveAction(db: Db, actionId: string, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(actionQueue)
      .set({ resolved: true })
      .where(and(eq(actionQueue.id, actionId), eq(actionQueue.resolved, false)))
      .returning();
    if (!claimed) return false; // already resolved elsewhere

    if (claimed.type === 'move') {
      const payload = movePayloadSchema.parse(claimed.payload);
      const target = await tx.query.hexes.findFirst({
        where: eq(hexes.id, payload.targetHexId),
      });
      if (!target) throw new Error(`Move target hex ${payload.targetHexId} missing`);

      await tx
        .update(characters)
        .set({ hexId: target.id })
        .where(eq(characters.id, claimed.characterId));

      const discoveredHexIds = await discoverAround(tx, claimed.characterId, target);
      const result = moveResultSchema.parse({ movedToHexId: target.id, discoveredHexIds });
      await tx.update(actionQueue).set({ result }).where(eq(actionQueue.id, claimed.id));
    } else if (claimed.type === 'rest') {
      const payload = restPayloadSchema.parse(claimed.payload);
      const [character] = await tx
        .select()
        .from(characters)
        .where(eq(characters.id, claimed.characterId))
        .for('update');
      if (!character) throw new Error(`Character ${claimed.characterId} missing`);

      const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, character.hexId) });
      const computed = computeStamina(
        { stamina: character.stamina, staminaUpdatedAt: character.staminaUpdatedAt },
        claimed.endsAt < now ? claimed.endsAt : now,
        hex ? regenContextFor(hex) : 'field',
      );
      const stamina = Math.min(STAMINA_MAX, computed.stamina + payload.staminaGain);
      await tx
        .update(characters)
        .set({ stamina, staminaUpdatedAt: claimed.endsAt })
        .where(eq(characters.id, character.id));

      const result = restResultSchema.parse({ staminaGained: stamina - computed.stamina });
      await tx.update(actionQueue).set({ result }).where(eq(actionQueue.id, claimed.id));
    }

    // Shift the remaining queue down, lowest position first, so the partial
    // unique index (character_id, position) never sees a transient clash.
    const remaining = await unresolvedQueue(tx, claimed.characterId);
    for (const row of remaining) {
      if (row.position > claimed.position) {
        await tx
          .update(actionQueue)
          .set({ position: row.position - 1 })
          .where(eq(actionQueue.id, row.id));
      }
    }
    return true;
  });
}

/**
 * Lazy resolution: applies every due action for a character, in order.
 * Every read of character state goes through here first (ARCHITECTURE §4.3).
 */
export async function resolveDueActions(db: Db, characterId: string, now: Date): Promise<void> {
  const due = await db
    .select()
    .from(actionQueue)
    .where(
      and(
        eq(actionQueue.characterId, characterId),
        eq(actionQueue.resolved, false),
        lte(actionQueue.endsAt, now),
      ),
    )
    .orderBy(asc(actionQueue.position));

  for (const action of due) {
    await resolveAction(db, action.id, now);
  }
}

/** Where the character will stand once the current queue has run. */
async function virtualHex(tx: Tx | Db, character: CharacterRow, queue: ActionRow[]): Promise<HexRow> {
  const lastMove = [...queue].reverse().find((a) => a.type === 'move');
  const hexId = lastMove
    ? movePayloadSchema.parse(lastMove.payload).targetHexId
    : character.hexId;
  const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, hexId) });
  if (!hex) throw new Error(`Hex ${hexId} missing`);
  return hex;
}

export async function enqueueAction(
  db: Db,
  characterId: string,
  input: CreateActionInput,
  now: Date,
): Promise<ActionDto> {
  await resolveDueActions(db, characterId, now);

  return db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    if (!character) throw new AppError('NOT_FOUND', 404);

    const queue = await unresolvedQueue(tx, characterId);
    if (queue.length >= ACTION_QUEUE_MAX) {
      throw new AppError('QUEUE_FULL', 409);
    }

    const from = await virtualHex(tx, character, queue);
    const startsAt = queue.length === 0 ? now : queue[queue.length - 1]!.endsAt;

    if (input.type === 'move') {
      const target = await tx.query.hexes.findFirst({
        where: eq(hexes.id, input.targetHexId),
      });
      if (!target) throw new AppError('NOT_FOUND', 404);

      const region = await tx.query.regions.findFirst({
        where: eq(regions.id, target.regionId),
      });
      if (!region?.unlocked) {
        throw new AppError('HEX_LOCKED', 409);
      }
      if (!isAdjacent({ q: from.q, r: from.r }, { q: target.q, r: target.r })) {
        throw new AppError('NOT_ADJACENT', 409);
      }

      const mist = effectiveMistLevel(region.mistLevel, target.mistDelta) as MistLevel;
      const cost = moveCost(target.terrain, mist);

      const currentHex = await tx.query.hexes.findFirst({ where: eq(hexes.id, character.hexId) });
      const computed = computeStamina(
        { stamina: character.stamina, staminaUpdatedAt: character.staminaUpdatedAt },
        now,
        currentHex ? regenContextFor(currentHex) : 'field',
      );
      if (computed.stamina < cost.stamina) {
        throw new AppError('INSUFFICIENT_STAMINA', 409, {
          required: cost.stamina,
          current: computed.stamina,
        });
      }
      await tx
        .update(characters)
        .set({
          stamina: computed.stamina - cost.stamina,
          staminaUpdatedAt: computed.staminaUpdatedAt,
        })
        .where(eq(characters.id, character.id));

      const payload = movePayloadSchema.parse({
        targetHexId: target.id,
        staminaCost: cost.stamina,
        durationSeconds: cost.durationSeconds,
      });
      const [row] = await tx
        .insert(actionQueue)
        .values({
          characterId,
          type: 'move',
          payload,
          position: queue.length,
          startsAt,
          endsAt: new Date(startsAt.getTime() + cost.durationSeconds * 1000),
        })
        .returning();
      return toActionDto(row!);
    }

    // rest
    if (from.terrain !== 'shrine') {
      throw new AppError('NOT_ON_SHRINE', 409);
    }
    const payload = restPayloadSchema.parse({
      durationSeconds: REST_ACTION.durationMinutes * 60,
      staminaGain: REST_ACTION.staminaGain,
    });
    const [row] = await tx
      .insert(actionQueue)
      .values({
        characterId,
        type: 'rest',
        payload,
        position: queue.length,
        startsAt,
        endsAt: new Date(startsAt.getTime() + payload.durationSeconds * 1000),
      })
      .returning();
    return toActionDto(row!);
  });
}

export async function cancelAction(
  db: Db,
  characterId: string,
  actionId: string,
  now: Date,
): Promise<void> {
  await resolveDueActions(db, characterId, now);

  await db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    if (!character) throw new AppError('NOT_FOUND', 404);

    const action = await tx.query.actionQueue.findFirst({
      where: and(
        eq(actionQueue.id, actionId),
        eq(actionQueue.characterId, characterId),
        eq(actionQueue.resolved, false),
      ),
    });
    if (!action) throw new AppError('NOT_FOUND', 404);

    if (action.position === 0 && action.startsAt.getTime() <= now.getTime()) {
      throw new AppError('ACTION_ALREADY_STARTED', 409);
    }

    if (action.type === 'move') {
      const payload = movePayloadSchema.parse(action.payload);
      const computed = computeStamina(
        { stamina: character.stamina, staminaUpdatedAt: character.staminaUpdatedAt },
        now,
      );
      await tx
        .update(characters)
        .set({
          stamina: Math.min(STAMINA_MAX, computed.stamina + payload.staminaCost),
          staminaUpdatedAt: computed.staminaUpdatedAt,
        })
        .where(eq(characters.id, character.id));
    }

    await tx.delete(actionQueue).where(eq(actionQueue.id, action.id));

    // Re-chain what remains: positions close up and each action starts when
    // the previous one ends (or now, for the new head of the queue).
    const remaining = await unresolvedQueue(tx, characterId);
    let previousEndsAt: Date | null = null;
    for (const [index, row] of remaining.entries()) {
      const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
      const startsAt: Date =
        index === 0
          ? row.position === 0
            ? row.startsAt // head already running: keep its clock
            : now
          : previousEndsAt!;
      const endsAt: Date = new Date(startsAt.getTime() + durationMs);
      await tx
        .update(actionQueue)
        .set({ position: index, startsAt, endsAt })
        .where(eq(actionQueue.id, row.id));
      previousEndsAt = endsAt;
    }
  });
}
