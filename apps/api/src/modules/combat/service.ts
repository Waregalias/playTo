import { and, eq } from 'drizzle-orm';
import {
  FOES,
  STARTER_SKILLS,
  COMBAT_STAMINA_COST,
  DEATH_PENALTY,
  maxHp,
  resolveAttack,
  rollInitiative,
  fleeChance,
  effectiveAttributes,
  combatLogEntrySchema,
  combatRewardsSchema,
  computeStamina,
  type CombatActionInput,
  type CombatLogEntry,
  type CombatRewards,
  type CombatStateDto,
  type Rng,
} from '@aldenfer/shared';
import { FOES_FR, ITEMS_FR } from '@aldenfer/shared/content/fr';
import type { Db } from '../../db/client.js';
import { characters, combats, hexes, inventory, items, actionQueue } from '../../db/schema.js';
import { SPAWN_POI_TYPE } from '../../db/seed/world-data.js';
import { AppError } from '../../lib/app-error.js';
import { applyXp } from '../../lib/progression.js';
import { addItem, equippedGear, inventoryCapacity, loseMaterialsOnDeath } from '../inventory/service.js';
import { advanceOnEvent } from '../quests/hooks.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type CombatRow = typeof combats.$inferSelect;
type CharacterRow = typeof characters.$inferSelect;

function log(entries: CombatLogEntry[], entry: CombatLogEntry): CombatLogEntry[] {
  return [...entries, combatLogEntrySchema.parse(entry)];
}

function foeName(slug: string): string {
  return FOES_FR[slug]?.name ?? slug;
}

/**
 * Starts a combat for a character (encounter roll or scripted quest fight).
 * Runs inside the caller's transaction. Costs 15 stamina, floored at 0 —
 * the Mist does not ask whether you are ready.
 */
export async function startCombat(
  tx: Tx,
  character: CharacterRow,
  foeSlug: string,
  now: Date,
  rng: Rng,
  questId?: string,
): Promise<string> {
  const foe = FOES[foeSlug];
  if (!foe) throw new Error(`Unknown foe ${foeSlug}`);

  const existing = await tx.query.combats.findFirst({
    where: and(eq(combats.characterId, character.id), eq(combats.status, 'active')),
  });
  if (existing) throw new AppError('COMBAT_ALREADY_ACTIVE', 409);

  // Combat stamina (GDD §8), clamped at zero.
  const computed = computeStamina(
    { stamina: character.stamina, staminaUpdatedAt: character.staminaUpdatedAt },
    now,
  );
  await tx
    .update(characters)
    .set({
      stamina: Math.max(0, computed.stamina - COMBAT_STAMINA_COST),
      staminaUpdatedAt: computed.staminaUpdatedAt,
    })
    .where(eq(characters.id, character.id));

  const penalty = !!character.deathPenaltyUntil && character.deathPenaltyUntil > now;
  const attrs = effectiveAttributes(
    { str: character.str, dex: character.dex, wil: character.wil, vit: character.vit, fer: character.fer },
    penalty,
  );

  let entries = log([], {
    turn: 1,
    actor: 'system',
    text: FOES_FR[foeSlug]?.intro ?? `${foeName(foeSlug)} émerge de la Brume.`,
  });

  let playerHp = character.hp;

  // Initiative (GDD §13): the loser of the roll concedes the opening blow.
  const playerInit = rollInitiative(attrs.dex, rng);
  const foeInit = rollInitiative(foe.dex, rng);
  if (foeInit > playerInit) {
    const gear = await equippedGear(tx, character.id);
    const opening = resolveAttack(
      { attackScore: foe.attack, mitigation: gear.armor, attackerDex: foe.dex, defenderDex: attrs.dex },
      rng,
    );
    playerHp = Math.max(0, playerHp - opening.damage);
    entries = log(entries, {
      turn: 1,
      actor: 'foe',
      text:
        opening.outcome === 'dodged'
          ? `${foeName(foeSlug)} surgit — tu esquives son premier assaut.`
          : `${foeName(foeSlug)} frappe le premier.`,
      ...(opening.damage > 0 ? { dmg: opening.damage } : {}),
    });
  }

  const [row] = await tx
    .insert(combats)
    .values({
      characterId: character.id,
      foeSlug,
      foeHp: foe.hpMax,
      foeHpMax: foe.hpMax,
      playerHp,
      turn: 1,
      cooldowns: {},
      log: entries,
      questId: questId ?? null,
    })
    .returning();
  if (!row) throw new Error('Combat insert returned no row');

  // An opening blow can kill — resolve the defeat in the same transaction.
  if (playerHp <= 0) {
    await applyDefeat(tx, character, row, entries, now);
  }
  return row.id;
}

export async function getActiveCombat(db: Db | Tx, characterId: string): Promise<CombatRow | null> {
  const row = await db.query.combats.findFirst({
    where: and(eq(combats.characterId, characterId), eq(combats.status, 'active')),
  });
  return row ?? null;
}

export interface TurnOutcome {
  combat: CombatRow;
  /** Set when the player won — feeds the quest kill hook at the route layer. */
  wonAgainstFoe?: string;
}

/** One full player turn: action, then the foe's riposte (US2). */
export async function playTurn(
  db: Db,
  characterId: string,
  input: CombatActionInput,
  now: Date,
  rng: Rng,
): Promise<TurnOutcome> {
  return db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .for('update');
    if (!character) throw new AppError('NOT_FOUND', 404);

    const combat = await getActiveCombat(tx, characterId);
    if (!combat) throw new AppError('NO_ACTIVE_COMBAT', 409);

    const foe = FOES[combat.foeSlug];
    if (!foe) throw new Error(`Unknown foe ${combat.foeSlug}`);

    const penalty = !!character.deathPenaltyUntil && character.deathPenaltyUntil > now;
    const attrs = effectiveAttributes(
      { str: character.str, dex: character.dex, wil: character.wil, vit: character.vit, fer: character.fer },
      penalty,
    );
    const gear = await equippedGear(tx, characterId);
    const cooldowns = { ...(combat.cooldowns as Record<string, number>) };

    let entries = combat.log as CombatLogEntry[];
    let foeHp = combat.foeHp;
    let playerHp = combat.playerHp;
    const turn = combat.turn;
    let fled = false;

    // ── Player action
    if (input.action === 'attack' || input.action === 'skill') {
      let multiplier = 1;
      let kind = gear.damageKind;
      let label = 'Attaque';

      if (input.action === 'skill') {
        const starter = STARTER_SKILLS[character.class];
        if (input.skillId !== starter.id) throw new AppError('REQUIREMENT_NOT_MET', 409);
        if ((cooldowns[starter.id] ?? 0) > 0) throw new AppError('REQUIREMENT_NOT_MET', 409);
        multiplier = starter.multiplier;
        kind = starter.kind;
        cooldowns[starter.id] = starter.cooldown + 1; // ticks down at end of this turn
        label = 'Compétence';
      }

      const attackScore =
        kind === 'arcane' ? attrs.wil * 2 + gear.weaponPower : attrs.str * 2 + gear.weaponPower;
      const hit = resolveAttack(
        {
          attackScore,
          mitigation: kind === 'arcane' ? foe.resist : foe.armor,
          attackerDex: attrs.dex,
          defenderDex: foe.dex,
          multiplier,
        },
        rng,
      );
      foeHp = Math.max(0, foeHp - hit.damage);
      entries = log(entries, {
        turn,
        actor: 'player',
        text:
          hit.outcome === 'dodged'
            ? `${label} — ${foeName(combat.foeSlug)} esquive.`
            : hit.outcome === 'crit'
              ? `${label} — coup critique !`
              : `${label}.`,
        ...(hit.damage > 0 ? { dmg: hit.damage } : {}),
      });
    } else if (input.action === 'item') {
      const entry = await tx.query.inventory.findFirst({
        where: and(eq(inventory.characterId, characterId), eq(inventory.itemId, input.itemId)),
      });
      if (!entry) throw new AppError('NOT_FOUND', 404);
      const item = await tx.query.items.findFirst({ where: eq(items.id, entry.itemId) });
      const heal = (item?.stats as { heal?: number } | null)?.heal;
      if (item?.kind !== 'consumable' || !heal) throw new AppError('REQUIREMENT_NOT_MET', 409);

      playerHp = Math.min(maxHp(attrs.vit), playerHp + heal);
      if (entry.qty > 1) {
        await tx.update(inventory).set({ qty: entry.qty - 1 }).where(eq(inventory.id, entry.id));
      } else {
        await tx.delete(inventory).where(eq(inventory.id, entry.id));
      }
      entries = log(entries, {
        turn,
        actor: 'player',
        text: `${ITEMS_FR[entry.itemId]?.name ?? entry.itemId} : +${heal} PV.`,
      });
    } else {
      // flee
      if (rng() < fleeChance(attrs.dex, foe.dex)) {
        fled = true;
        entries = log(entries, { turn, actor: 'system', text: 'Tu te fonds dans la Brume. Fuite réussie.' });
      } else {
        entries = log(entries, { turn, actor: 'system', text: 'Fuite manquée — la Brume te rejette.' });
      }
    }

    // ── Victory?
    if (foeHp <= 0) {
      const rewards = await applyVictory(tx, character, foe.slug, now, rng);
      // Quest hooks — same transaction as the victory itself (US6).
      await advanceOnEvent(tx, characterId, { kind: 'kill', foeSlug: foe.slug });
      if (combat.questId) {
        await advanceOnEvent(tx, characterId, {
          kind: 'combat-won',
          questId: combat.questId,
          foeSlug: foe.slug,
        });
      }
      const [updated] = await tx
        .update(combats)
        .set({
          foeHp: 0,
          playerHp,
          status: 'won',
          log: log(entries, {
            turn,
            actor: 'system',
            text: `${foeName(combat.foeSlug)} se disperse en volutes grises. Victoire !`,
          }),
          cooldowns,
          rewards,
        })
        .where(eq(combats.id, combat.id))
        .returning();
      await tx.update(characters).set({ hp: playerHp }).where(eq(characters.id, characterId));
      return { combat: updated!, wonAgainstFoe: foe.slug };
    }

    // ── Fled?
    if (fled) {
      const [updated] = await tx
        .update(combats)
        .set({ playerHp, status: 'fled', log: entries, cooldowns })
        .where(eq(combats.id, combat.id))
        .returning();
      await tx.update(characters).set({ hp: playerHp }).where(eq(characters.id, characterId));
      return { combat: updated! };
    }

    // ── Foe riposte
    const riposte = resolveAttack(
      { attackScore: foe.attack, mitigation: gear.armor, attackerDex: foe.dex, defenderDex: attrs.dex },
      rng,
    );
    playerHp = Math.max(0, playerHp - riposte.damage);
    entries = log(entries, {
      turn,
      actor: 'foe',
      text:
        riposte.outcome === 'dodged'
          ? `${foeName(combat.foeSlug)} attaque — esquivé.`
          : `${foeName(combat.foeSlug)} riposte.`,
      ...(riposte.damage > 0 ? { dmg: riposte.damage } : {}),
    });

    // ── Defeat?
    if (playerHp <= 0) {
      const [updated] = await tx
        .update(combats)
        .set({ foeHp, playerHp: 0, status: 'lost', log: entries, cooldowns })
        .where(eq(combats.id, combat.id))
        .returning();
      await applyDefeat(tx, character, updated!, entries, now);
      return { combat: updated! };
    }

    // ── Next turn: tick cooldowns down.
    for (const key of Object.keys(cooldowns)) {
      cooldowns[key] = Math.max(0, (cooldowns[key] ?? 0) - 1);
    }
    const [updated] = await tx
      .update(combats)
      .set({ foeHp, playerHp, turn: turn + 1, log: entries, cooldowns })
      .where(eq(combats.id, combat.id))
      .returning();
    await tx.update(characters).set({ hp: playerHp }).where(eq(characters.id, characterId));
    return { combat: updated! };
  });
}

/** XP, crowns, loot, level-ups — inside the victory transaction. */
async function applyVictory(
  tx: Tx,
  character: CharacterRow,
  foeSlug: string,
  now: Date,
  rng: Rng,
): Promise<CombatRewards> {
  const foe = FOES[foeSlug]!;
  const crowns = foe.crownsMin + Math.floor(rng() * (foe.crownsMax - foe.crownsMin + 1));

  const progress = applyXp(character, foe.xpReward);
  const capacity = inventoryCapacity(character.str);

  const loot: CombatRewards['loot'] = [];
  const lootLost: NonNullable<CombatRewards['lootLost']> = [];
  for (const entry of foe.loot) {
    if (rng() >= entry.chance) continue;
    const qty = entry.qtyMin + Math.floor(rng() * (entry.qtyMax - entry.qtyMin + 1));
    const result = await addItem(tx, character.id, entry.itemId, qty, capacity);
    if (result.added > 0) loot.push({ itemId: entry.itemId, qty: result.added });
    if (result.lost > 0) lootLost.push({ itemId: entry.itemId, qty: result.lost });
  }

  await tx
    .update(characters)
    .set({
      xp: progress.xp,
      level: progress.level,
      attributePoints: progress.attributePoints,
      skillPoints: progress.skillPoints,
      ashCrowns: character.ashCrowns + crowns,
    })
    .where(eq(characters.id, character.id));

  return combatRewardsSchema.parse({
    xp: foe.xpReward,
    ashCrowns: crowns,
    loot,
    ...(progress.leveledTo ? { levelUp: progress.leveledTo } : {}),
    ...(lootLost.length > 0 ? { lootLost } : {}),
  });
}

/**
 * Death of a Rekindled (GDD §2.4, US3): respawn at the Ember Hall at half
 * HP, 2 h stat penalty, 25 % of material stacks lost, action queue wiped.
 */
async function applyDefeat(
  tx: Tx,
  character: CharacterRow,
  combat: CombatRow,
  entries: CombatLogEntry[],
  now: Date,
): Promise<void> {
  const spawn = await tx.query.hexes.findFirst({ where: eq(hexes.poiType, SPAWN_POI_TYPE) });
  if (!spawn) throw new Error('Spawn hex missing — run db:seed');

  await loseMaterialsOnDeath(tx, character.id);

  await tx
    .update(actionQueue)
    .set({ resolved: true, result: { cancelled: 'death' } })
    .where(and(eq(actionQueue.characterId, character.id), eq(actionQueue.resolved, false)));

  await tx
    .update(characters)
    .set({
      hp: Math.round(maxHp(character.vit) * DEATH_PENALTY.respawnHpRatio),
      hexId: spawn.id,
      deathPenaltyUntil: new Date(now.getTime() + DEATH_PENALTY.durationHours * 3_600_000),
    })
    .where(eq(characters.id, character.id));

  await tx
    .update(combats)
    .set({
      log: log(entries, {
        turn: combat.turn,
        actor: 'system',
        text: 'Ta flammèche vacille… Tu te réveilles au bastion, plus léger et plus faible (2 h).',
      }),
    })
    .where(eq(combats.id, combat.id));
}

export function toCombatStateDto(row: CombatRow, playerHpMax: number): CombatStateDto {
  return {
    id: row.id,
    foe: { slug: row.foeSlug, hp: row.foeHp, hpMax: row.foeHpMax },
    playerHp: row.playerHp,
    playerHpMax,
    turn: row.turn,
    cooldowns: row.cooldowns as Record<string, number>,
    log: row.log as CombatStateDto['log'],
    status: row.status,
    rewards: (row.rewards as CombatRewards | null) ?? undefined,
  };
}
