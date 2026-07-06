import { and, asc, eq, lte } from 'drizzle-orm';
import {
  ACTION_QUEUE_MAX,
  REST_ACTION,
  SEARCH_ACTION,
  STAMINA_MAX,
  ENCOUNTER_CHANCES,
  SEARCH_ENCOUNTER_BONUS,
  REGION_1_ENCOUNTER_POOL,
  POI_LOOT,
  computeStamina,
  effectiveMistLevel,
  isAdjacent,
  moveCost,
  neighbours,
  movePayloadSchema,
  restPayloadSchema,
  searchPayloadSchema,
  moveResultSchema,
  restResultSchema,
  searchResultSchema,
  type ActionDto,
  type CreateActionInput,
  type MistLevel,
  type Rng,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import {
  actionQueue,
  characters,
  discoveries,
  hexes,
  poiSearches,
  regions,
} from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { applyXp } from '../../lib/progression.js';
import { regenContextFor } from '../characters/service.js';
import { addItem, inventoryCapacity } from '../inventory/service.js';
import { startCombat, getActiveCombat } from '../combat/service.js';
import { advanceOnEvent } from '../quests/hooks.js';

type CharacterLockRow = typeof characters.$inferSelect;

/** Rolls a Mistborn encounter after a move/search resolution (US1). */
async function maybeStartEncounter(
  tx: Tx,
  character: CharacterLockRow,
  hex: HexRow,
  baseChance: number,
  now: Date,
  rng: Rng,
): Promise<{ encounterFoeSlug?: string; combatId?: string }> {
  if (hex.regionId === 0 || baseChance <= 0) return {};
  if (await getActiveCombat(tx, character.id)) return {}; // one fight at a time
  if (rng() >= baseChance) return {};
  const foeSlug =
    REGION_1_ENCOUNTER_POOL[Math.floor(rng() * REGION_1_ENCOUNTER_POOL.length)]!;
  const combatId = await startCombat(tx, character, foeSlug, now, rng);
  return { encounterFoeSlug: foeSlug, combatId };
}

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
export async function resolveAction(
  db: Db,
  actionId: string,
  now: Date,
  rng: Rng = Math.random,
): Promise<boolean> {
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

      // Quest hook (reach), then the Mist rolls its dice (US1).
      await advanceOnEvent(tx, claimed.characterId, { kind: 'reach', poiType: target.poiType });
      const [character] = await tx
        .select()
        .from(characters)
        .where(eq(characters.id, claimed.characterId))
        .for('update');
      const encounter = await maybeStartEncounter(
        tx,
        character!,
        target,
        ENCOUNTER_CHANCES[target.terrain] ?? 0,
        now,
        rng,
      );

      const result = moveResultSchema.parse({
        movedToHexId: target.id,
        discoveredHexIds,
        ...encounter,
      });
      await tx.update(actionQueue).set({ result }).where(eq(actionQueue.id, claimed.id));
    } else if (claimed.type === 'search') {
      const payload = searchPayloadSchema.parse(claimed.payload);
      const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, payload.hexId) });
      if (!hex) throw new Error(`Search hex ${payload.hexId} missing`);

      const [character] = await tx
        .select()
        .from(characters)
        .where(eq(characters.id, claimed.characterId))
        .for('update');
      if (!character) throw new Error(`Character ${claimed.characterId} missing`);

      // XP + loot rolls (server-side randomness, journaled in result).
      const progress = applyXp(character, SEARCH_ACTION.xpReward);
      const capacity = inventoryCapacity(character.str);
      const loot: Array<{ itemId: string; qty: number }> = [];
      const lootLost: Array<{ itemId: string; qty: number }> = [];
      for (const entry of POI_LOOT[payload.poiType] ?? []) {
        if (rng() >= entry.chance) continue;
        const qty = entry.qtyMin + Math.floor(rng() * (entry.qtyMax - entry.qtyMin + 1));
        const added = await addItem(tx, character.id, entry.itemId, qty, capacity);
        if (added.added > 0) loot.push({ itemId: entry.itemId, qty: added.added });
        if (added.lost > 0) lootLost.push({ itemId: entry.itemId, qty: added.lost });
      }
      await tx
        .update(characters)
        .set({
          xp: progress.xp,
          level: progress.level,
          attributePoints: progress.attributePoints,
          skillPoints: progress.skillPoints,
        })
        .where(eq(characters.id, character.id));

      await advanceOnEvent(tx, claimed.characterId, {
        kind: 'search',
        poiType: payload.poiType,
      });
      const encounter = await maybeStartEncounter(
        tx,
        character,
        hex,
        (ENCOUNTER_CHANCES[hex.terrain] ?? 0) + SEARCH_ENCOUNTER_BONUS,
        now,
        rng,
      );

      const result = searchResultSchema.parse({
        xp: SEARCH_ACTION.xpReward,
        loot,
        ...(lootLost.length > 0 ? { lootLost } : {}),
        ...encounter,
      });
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
export async function resolveDueActions(
  db: Db,
  characterId: string,
  now: Date,
  rng: Rng = Math.random,
): Promise<void> {
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
    await resolveAction(db, action.id, now, rng);
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
  rng: Rng = Math.random,
): Promise<ActionDto> {
  await resolveDueActions(db, characterId, now, rng);

  return db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    if (!character) throw new AppError('NOT_FOUND', 404);

    // A waiting Mistborn blocks any new intention (SPEC-M2 US1).
    if (await getActiveCombat(tx, characterId)) {
      throw new AppError('COMBAT_ALREADY_ACTIVE', 409);
    }

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

    if (input.type === 'search') {
      // Searchable POIs live outside the bastion (SPEC-M2 US4).
      if (!from.poiType || from.regionId === 0) {
        throw new AppError('NOT_ON_POI', 409);
      }
      const searchedOn = now.toISOString().slice(0, 10);
      const already = await tx.query.poiSearches.findFirst({
        where: and(
          eq(poiSearches.characterId, characterId),
          eq(poiSearches.hexId, from.id),
          eq(poiSearches.searchedOn, searchedOn),
        ),
      });
      if (already) {
        throw new AppError('POI_ALREADY_SEARCHED', 409);
      }

      const computed = computeStamina(
        { stamina: character.stamina, staminaUpdatedAt: character.staminaUpdatedAt },
        now,
        regenContextFor(from),
      );
      if (computed.stamina < SEARCH_ACTION.staminaCost) {
        throw new AppError('INSUFFICIENT_STAMINA', 409, {
          required: SEARCH_ACTION.staminaCost,
          current: computed.stamina,
        });
      }
      await tx
        .update(characters)
        .set({
          stamina: computed.stamina - SEARCH_ACTION.staminaCost,
          staminaUpdatedAt: computed.staminaUpdatedAt,
        })
        .where(eq(characters.id, character.id));

      // Claim the daily ledger at enqueue — released if cancelled.
      await tx.insert(poiSearches).values({ characterId, hexId: from.id, searchedOn });

      const payload = searchPayloadSchema.parse({
        hexId: from.id,
        poiType: from.poiType,
        searchedOn,
        durationSeconds: SEARCH_ACTION.durationMinutes * 60,
        staminaCost: SEARCH_ACTION.staminaCost,
      });
      const [row] = await tx
        .insert(actionQueue)
        .values({
          characterId,
          type: 'search',
          payload,
          position: queue.length,
          startsAt,
          endsAt: new Date(startsAt.getTime() + payload.durationSeconds * 1000),
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
  rng: Rng = Math.random,
): Promise<void> {
  await resolveDueActions(db, characterId, now, rng);

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

    if (action.type === 'move' || action.type === 'search') {
      const staminaCost =
        action.type === 'move'
          ? movePayloadSchema.parse(action.payload).staminaCost
          : searchPayloadSchema.parse(action.payload).staminaCost;
      const computed = computeStamina(
        { stamina: character.stamina, staminaUpdatedAt: character.staminaUpdatedAt },
        now,
      );
      await tx
        .update(characters)
        .set({
          stamina: Math.min(STAMINA_MAX, computed.stamina + staminaCost),
          staminaUpdatedAt: computed.staminaUpdatedAt,
        })
        .where(eq(characters.id, character.id));
    }

    // A cancelled search releases its daily ledger claim.
    if (action.type === 'search') {
      const payload = searchPayloadSchema.parse(action.payload);
      await tx
        .delete(poiSearches)
        .where(
          and(
            eq(poiSearches.characterId, characterId),
            eq(poiSearches.hexId, payload.hexId),
            eq(poiSearches.searchedOn, payload.searchedOn),
          ),
        );
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
