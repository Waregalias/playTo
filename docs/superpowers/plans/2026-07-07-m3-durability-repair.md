# M3 Durability & Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Write tests first (TDD).

**Goal:** SPEC-M3 step 8 / US7 — every death chips the equipped weapon and armour's durability; at 0 their combat stats are halved; `POST /inventory/repair { entryId }` restores them for an écu cost.

**Architecture:** `DEATH_DURABILITY_LOSS` (10) and `BROKEN_GEAR_PENALTY` (0.5) already exist in `constants/combat.ts`. `repairCost(missingDurability, itemTier)` already exists (step 1) but is unused — this plan wires it. Two new pure helpers land in `shared`: `itemTierFromId` (parses the `.t{N}` suffix already used by every weapon/armour id) and `deriveGearStats` (halves `power`/`armor` at durability 0). The `items` table already has `maxDurability` (nullable, currently unset by the seed) and `inventory` already has `durability` (nullable, currently never populated) — both columns exist since migration 0002/0003, no new migration needed.

**Tech Stack:** Drizzle, Zod, Fastify, Vitest. Reuses `equippedGear`, `addItem`, `toCharacterDto`, `AppError`.

## Global Constraints

- Le serveur fait autorité ; **transaction** autour de la réparation (débit écus + restauration durabilité) et de la perte à la mort (déjà dans la transaction de défaite M2).
- `maxDurability = 100` pour toute arme/armure (décision 2, tarif de réparation ajusté par palier via `itemTier`).
- Perte à la mort : **10 points**, bornée à 0, sur l'arme **et** l'armure équipées (si présentes) — même transaction que `applyDefeat`.
- À 0 : `power`/`armor` réduits de **50 %** (arrondi) — appliqué en lecture par `equippedGear`, jamais persisté (les stats de base restent inchangées en base).
- `POST /inventory/repair` : `409 NOTHING_TO_REPAIR` si pleine ou non réparable (mat./conso/quest), `409 INSUFFICIENT_FUNDS` sinon débit + durabilité → `maxDurability`.
- Aucune chaîne FR en dur ; erreurs déjà présentes (`NOTHING_TO_REPAIR`, `INSUFFICIENT_FUNDS`, `REQUIREMENT_NOT_MET`).
- Vérif : `pnpm --filter @aldenfer/shared test`, `pnpm --filter api test`, builds `tsc --noEmit`.
- Hors périmètre : re-forge / amélioration d'objet, durabilité sur les objets de quête.

---

### Task 1: shared — item tier parsing, gear-stat reduction, repair response schema

**Files:**

- Modify: `packages/shared/src/formulas/economy.ts` (add `itemTierFromId`) — same file as `repairCost`, both consumed together by the repair route.
- Modify: `packages/shared/src/formulas/economy.test.ts` (cases)
- Create: `packages/shared/src/formulas/gear.ts` (`deriveGearStats`)
- Create: `packages/shared/src/formulas/gear.test.ts`
- Modify: `packages/shared/src/formulas/index.ts` (export `gear.js`)
- Modify: `packages/shared/src/schemas/inventory.ts` (add `durability`/`maxDurability` to `inventoryEntrySchema`; add `repairSchema` + `repairResponseSchema`)

**Interfaces:**

```ts
// economy.ts
/** Tier parsed from an item id's `.t{N}` suffix (e.g. "weapon.blade.t2" → 2); defaults to 1. */
export function itemTierFromId(itemId: string): number;
// gear.ts
import type { ItemStats } from '../schemas/inventory.js';
/** Halves power/armor when durability has hit 0 (SPEC-M3 décision 2). Read-time only, never persisted. Pure. */
export function deriveGearStats(stats: ItemStats, durability: number | null, maxDurability: number | null): ItemStats;
// inventory.ts (schema additions)
durability: z.number().int().min(0).nullable(),
maxDurability: z.number().int().positive().nullable(),
// …
export const repairSchema = z.object({ entryId: z.uuid() });
export const repairResponseSchema = z.object({ character: characterSchema, entry: inventoryEntrySchema });
```

- [ ] **Step 1: Failing tests**

`economy.test.ts` additions:

```ts
describe('itemTierFromId', () => {
  it('parses the trailing tier', () => {
    expect(itemTierFromId('weapon.blade.t2')).toBe(2);
    expect(itemTierFromId('armor.leather.t1')).toBe(1);
  });
  it('defaults to 1 when there is no tier suffix', () => {
    expect(itemTierFromId('material.shadewood')).toBe(1);
  });
});
```

`gear.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveGearStats } from './gear.js';

describe('deriveGearStats', () => {
  it('leaves stats untouched above 0 durability', () => {
    expect(deriveGearStats({ power: 10 }, 40, 100)).toEqual({ power: 10 });
  });
  it('halves power and armor at exactly 0 durability, rounded', () => {
    expect(deriveGearStats({ power: 11 }, 0, 100)).toEqual({ power: 6 }); // round(5.5)
    expect(deriveGearStats({ armor: 7 }, 0, 100)).toEqual({ armor: 4 }); // round(3.5)
  });
  it('is a no-op when the item has no maxDurability (unbreakable / not gear)', () => {
    expect(deriveGearStats({ power: 10 }, null, null)).toEqual({ power: 10 });
  });
});
```

Run both suites → FAIL (functions missing).

- [ ] **Step 2: Implement**

`economy.ts`:

```ts
/** Tier parsed from an item id's `.t{N}` suffix (e.g. "weapon.blade.t2" → 2); defaults to 1. */
export function itemTierFromId(itemId: string): number {
  const match = /\.t(\d+)$/.exec(itemId);
  return match ? Number(match[1]) : 1;
}
```

`gear.ts`:

```ts
import { BROKEN_GEAR_PENALTY } from '../constants/combat.js';
import type { ItemStats } from '../schemas/inventory.js';

/** Halves power/armor once durability hits 0 (SPEC-M3 décision 2). Read-time only — never persisted. Pure. */
export function deriveGearStats(
  stats: ItemStats,
  durability: number | null,
  maxDurability: number | null,
): ItemStats {
  if (durability !== 0 || maxDurability === null) return stats;
  return {
    ...stats,
    ...(stats.power !== undefined ? { power: Math.round(stats.power * BROKEN_GEAR_PENALTY) } : {}),
    ...(stats.armor !== undefined ? { armor: Math.round(stats.armor * BROKEN_GEAR_PENALTY) } : {}),
  };
}
```

Add `export * from './gear.js';` to `formulas/index.ts`.

Schema additions in `inventory.ts` — import `characterSchema` from `./character.js`:

```ts
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
// …
export const repairSchema = z.object({ entryId: z.uuid() });
export const repairResponseSchema = z.object({
  character: characterSchema,
  entry: inventoryEntrySchema,
});
export type RepairInput = z.infer<typeof repairSchema>;
export type RepairResponse = z.infer<typeof repairResponseSchema>;
```

- [ ] **Step 3: Verify & commit**

```bash
pnpm --filter @aldenfer/shared test && pnpm --filter @aldenfer/shared build
git add packages/shared/src/formulas/economy.ts packages/shared/src/formulas/economy.test.ts packages/shared/src/formulas/gear.ts packages/shared/src/formulas/gear.test.ts packages/shared/src/formulas/index.ts packages/shared/src/schemas/inventory.ts
git commit -m "feat(shared): item tier parsing, gear-stat reduction at 0 durability, repair schemas"
```

---

### Task 2: api — seed maxDurability, populate durability on acquisition, apply at read-time

**Files:**

- Modify: `apps/api/src/db/seed/items-data.ts` (weapons/armors get `maxDurability: 100`)
- Modify: `apps/api/src/modules/inventory/service.ts` (`addItem` sets `durability` on new non-stackable rows; `equippedGear` applies `deriveGearStats`)
- Modify: `apps/api/src/modules/characters/service.ts` (starter weapon insert sets `durability: 100`)
- Modify: `apps/api/src/modules/inventory/routes.ts` (`GET /inventory` exposes `durability`/`maxDurability`)

- [ ] **Step 1: Seed** — in `items-data.ts`, add `maxDurability: 100` to every entry in `weapons` and `armors` (materials/consumables stay without it — `undefined` → `null` in DB).

- [ ] **Step 2: `addItem` sets durability on non-stackable acquisition** — in the non-stackable loop, insert `durability: item.maxDurability ?? undefined` alongside `itemId`/`qty`. Stackable items (materials, consumables) never carry durability.

- [ ] **Step 3: Starter kit** — in `characters/service.ts`, the starter weapon insert (`inserted.id, STARTER_WEAPONS[input.class], equipped: true`) gets `durability: 100` (every starter weapon is tier 1, `maxDurability` 100).

- [ ] **Step 4: `equippedGear` applies the break penalty at read time** — in `inventory/service.ts`, when building `EquippedGear`, replace the raw `itemStatsSchema.parse(row.stats)` use with `deriveGearStats(parsedStats, row.entry.durability, item.maxDurability)` before reading `power`/`armor`. Requires selecting `entry.durability` and `items.maxDurability` in the query (already selecting `entry` and `stats`; add `maxDurability: items.maxDurability` to the select).

- [ ] **Step 5: Expose in `GET /inventory`** — in `inventory/routes.ts`, add `durability: entry.durability, maxDurability: item.maxDurability` to the mapped response.

- [ ] **Step 6: Verify** — `pnpm --filter api test` (all existing suites must stay green: starter kit test, combat tests, quest Q4 weapon reward test). `pnpm --filter api build`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/seed/items-data.ts apps/api/src/modules/inventory/service.ts apps/api/src/modules/characters/service.ts apps/api/src/modules/inventory/routes.ts
git commit -m "feat(api): seed gear durability + apply the 0-durability stat penalty at read time"
```

---

### Task 3: api — durability loss on death + repair endpoint

**Files:**

- Modify: `apps/api/src/modules/combat/service.ts` (`applyDefeat` decrements durability)
- Create: `apps/api/src/modules/inventory/repair.test.ts` (or extend `routes.test.ts` if one exists — check first)
- Modify: `apps/api/src/modules/inventory/routes.ts` (`POST /inventory/repair`)
- Modify: `apps/api/src/modules/combat/routes.test.ts` (death durability case)

- [ ] **Step 1: Failing death test** — extend the existing `death & respawn (US3)` describe in `combat/routes.test.ts`: seed the character's equipped weapon (already inserted by `makeChar`/starter kit — grab its inventory row) with `durability: 15`, force a losing turn, assert the row lands at `5` (15 − 10). A second case starts at `durability: 3` and asserts it floors at `0` (not negative).

- [ ] **Step 2: Implement the death wiring** — in `combat/service.ts` `applyDefeat`, after `loseMaterialsOnDeath`, select the character's equipped weapon + armour inventory rows (`eq(inventory.characterId) && eq(inventory.equipped, true)`, joined with `items` for `kind`), and for each row with a non-null `durability`, `update … set { durability: Math.max(0, durability - DEATH_DURABILITY_LOSS) }`. Import `DEATH_DURABILITY_LOSS` from `@aldenfer/shared`.

- [ ] **Step 3: Verify** — `pnpm --filter api test combat` PASS.

- [ ] **Step 4: Failing repair tests** — new `apps/api/src/modules/inventory/repair.test.ts` (reuse `signUp`/`makeChar` pattern). Cover:
  - repairs a damaged weapon: seed `ashCrowns` + set the starter weapon's `durability` to 60 → `POST /inventory/repair {entryId}` → 200, `entry.durability===100`, `character.currencies.ashCrowns` debited by `repairCost(40,1)=40`.
  - `409 NOTHING_TO_REPAIR` when durability is already `maxDurability`.
  - `409 INSUFFICIENT_FUNDS` when écus are short.
  - `409 REQUIREMENT_NOT_MET` when the entry is a material/consumable (no durability concept).
  - `409 NOT_FOUND` / ownership: repairing someone else's entry id → `NOT_FOUND`.

- [ ] **Step 5: Implement the route** — in `inventory/routes.ts`:

```ts
typed.post(
  '/api/v1/inventory/repair',
  { schema: { body: repairSchema, response: { 200: repairResponseSchema } } },
  async (request) => {
    const character = await requireCharacter(app.db, auth, request);
    return repairEntry(app.db, character, request.body.entryId, now());
  },
);
```

Add `repairEntry` to `inventory/service.ts`:

```ts
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
    if (!charRow || charRow.ashCrowns < cost) throw new AppError('INSUFFICIENT_FUNDS', 409);

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
      entry: {
        id: updatedEntry!.id,
        itemId: updatedEntry!.itemId,
        kind: row.item.kind as InventoryEntryDto['kind'],
        rarity: row.item.rarity,
        qty: updatedEntry!.qty,
        equipped: updatedEntry!.equipped,
        stats: row.item.stats ? itemStatsSchema.parse(row.item.stats) : null,
        durability: updatedEntry!.durability,
        maxDurability: row.item.maxDurability,
      },
    };
  });
}
```

(Match whatever the actual `toInventoryEntryDto`-style mapping already used in the `GET /inventory` route — extract a small shared mapper if that reduces duplication; keep it a surgical addition otherwise.)

- [ ] **Step 6: Verify & commit**

```bash
pnpm --filter api test && pnpm --filter api build
git add apps/api/src/modules/combat/service.ts apps/api/src/modules/combat/routes.test.ts apps/api/src/modules/inventory/
git commit -m "feat(api): equipment durability loss on death + repair endpoint"
```

---

## Self-Review

**Spec coverage (SPEC-M3 step 8 = durability + repair, US7):**

- Death decrements equipped weapon + armour durability by 10, floored at 0 → Task 3. ✅
- Durability 0 → stats halved via `deriveGearStats`, applied in `equippedGear` (combat-visible) → Tasks 1 + 2. ✅
- `POST /inventory/repair` — `NOTHING_TO_REPAIR`, cost = `repairCost(missing, itemTier)`, `INSUFFICIENT_FUNDS`, transaction, durability restored → Task 3. ✅

**Type consistency:** `itemTierFromId`/`deriveGearStats`/`repairCost` (Task 1, `repairCost` pre-existing) consumed verbatim by `repairEntry` (Task 3). `inventoryEntrySchema`'s new `durability`/`maxDurability` fields (Task 1) populated by both `GET /inventory` (Task 2) and the repair response (Task 3) — same shape. `addItem`'s new durability-on-acquisition (Task 2) is what makes Task 3's death/repair flow meaningful for looted or quest-reward gear, not just the starter weapon.

**Documented simplification:** durability is not exposed on `characterSchema`/the Hero screen directly in this milestone's API — the web plan (step 9) reads it from `GET /inventory` for the equipped rows, matching where the repair button lives per SPEC-M3 §Web ("durabilité + bouton réparer dans l'inventaire").

## Notes for the web plan (step 9)

- Inventory entries now carry `durability`/`maxDurability` (null for non-gear). Render a bar/badge on weapon/armor rows; a "Réparer" button posts `entryId` and refetches `GET /inventory` + `GET /characters/me` (funds changed).
- No realtime signal for repair/death durability — same pattern as the market (step 6): refetch after the mutating call.
