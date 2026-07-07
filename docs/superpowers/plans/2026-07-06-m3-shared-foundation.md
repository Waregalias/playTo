# M3 Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `packages/shared` foundation for milestone M3 « Ensemble » — the 60-skill catalog, the pure game formulas (`deriveSkillModifiers`, `repairCost`, `contributionCredit`), the Zod contracts (chat, projects, market, skills, WebSocket envelope), and the French content — so every M3 API/web task consumes tested, typed primitives.

**Architecture:** All game data and formulas live in `packages/shared` as pure, framework-free TypeScript. Skills are static data (`SkillDef[]`) sourced verbatim from GDD §5; passive effects aggregate into a flat `SkillModifiers` object via a pure reducer; active effects carry combat params consumed later by the API combat service. Zod schemas are the single source of truth for the API/WS contract. No DB, no Fastify, no Angular in this slice.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Zod 4, Vitest.

## Global Constraints

- Code 100 % anglais ; termes métier suivent `docs/GLOSSARY.md` (skill, tier, durability, repair, listing, contribution, channel — déjà ajoutés).
- Toute chaîne visible par le joueur vit dans `packages/shared/src/content/fr/` — jamais en dur.
- Les formules de jeu sont des fonctions **pures** dans `packages/shared/src/formulas/` ; l'aléa est injecté (`Rng = () => number`), jamais `Math.random()` interne.
- Zod partout : chaque forme d'entrée/sortie a son schéma ; chaque JSONB aura son schéma.
- Import ESM avec extension `.js` (ex. `import { ... } from './classes.js'`).
- Skill ids : `{class}.{branch}.{tier}` (GLOSSARY §Branches). Branches EN : blade=`bulwark`/`steel`/`veteran`, arcanist=`ashlight`/`veil`/`scholar`, scout=`hunt`/`travel`/`shadow`, cantor=`hymn`/`ember`/`verse`.
- Décisions SPEC-M3 : contribution clampée au restant ; Offrande ×1,4 sur la quantité créditée ; usure −10 durabilité/mort, stats −50 % à 0 ; 2 slots actifs ; paliers 4–5 coûtent des fragments ; actifs inertes apprenables mais non équipables.
- Vérif : `pnpm --filter @aldenfer/shared test` (adapter le nom du package si différent — voir `packages/shared/package.json`).

---

### Task 1: Skill catalog — types, effect model & data

**Files:**
- Create: `packages/shared/src/constants/skills.ts`
- Test: `packages/shared/src/constants/skills.test.ts`
- Modify: `packages/shared/src/constants/index.ts` (add `export * from './skills.js';`)

**Interfaces:**
- Consumes: `CharacterClass` from `./classes.js`.
- Produces:
  - `SkillBranch` (string union of the 12 branch codes).
  - `SkillModifiers` — flat aggregate of the M3-wired passive effects:
    ```ts
    export interface SkillModifiers {
      armorPct: number;          // +% armour (Garde ferme)
      dodgePct: number;          // +% dodge (Miroir de brume)
      searchLootPct: number;     // +% search loot (Lecture des runes)
      moveTimerPct: number;      // −% move timer, stored positive (Pas léger)
      visionBonus: number;       // +hex vision radius (Longue-Vue, Cartographe)
      inventoryBonus: number;    // +inventory slots (Porteur)
      deathMaterialLossPct: number; // −% material loss on death, positive (Poche double)
      contributionMult: number;  // ×contribution credit (Offrande) — default 1
      firstTurnDmgPct: number;   // +% damage on turn 1 (Embuscade)
      foeAshCrownsPct: number;   // +% ash crowns from foes (Détrousseur)
      blockFirstAttack: boolean; // Mur de fer
      fleeNoPenalty: boolean;    // Évasion
    }
    ```
  - `ActiveSkillParams`:
    ```ts
    export interface ActiveSkillParams {
      multiplier?: number;          // damage vs class attack score
      cooldown: number;             // turns
      damageKind?: 'physical' | 'arcane';
      ignoreArmorPct?: number;      // Fente
      bleedTurns?: number;          // Flèche barbelée
    }
    ```
  - `SkillDef`:
    ```ts
    export interface SkillDef {
      id: string;
      class: CharacterClass;
      branch: SkillBranch;
      tier: 1 | 2 | 3 | 4 | 5;
      kind: 'active' | 'passive';
      wiredInM3: boolean;           // effect applied this milestone
      fragmentCost: number;         // emberFragments cost (0 for tiers 1–3)
      modifiers?: Partial<SkillModifiers>; // passive contribution
      active?: ActiveSkillParams;   // present iff kind === 'active'
    }
    ```
  - `SKILLS: readonly SkillDef[]` (60 entries).
  - `SKILLS_BY_ID: Record<string, SkillDef>` and helper `getSkill(id: string): SkillDef | undefined`.
  - `EMPTY_MODIFIERS: SkillModifiers` (identity: all `0`, `contributionMult: 1`, booleans `false`).

- [ ] **Step 1: Write the failing invariant test**

`packages/shared/src/constants/skills.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CHARACTER_CLASSES } from './classes.js';
import { SKILLS, SKILLS_BY_ID, getSkill, EMPTY_MODIFIERS } from './skills.js';

const BRANCHES: Record<string, [string, string, string]> = {
  blade: ['bulwark', 'steel', 'veteran'],
  arcanist: ['ashlight', 'veil', 'scholar'],
  scout: ['hunt', 'travel', 'shadow'],
  cantor: ['hymn', 'ember', 'verse'],
};

describe('skill catalog', () => {
  it('has exactly 60 skills: 4 classes × 3 branches × 5 tiers', () => {
    expect(SKILLS).toHaveLength(60);
  });

  it('covers every class/branch/tier once with a well-formed id', () => {
    for (const cls of CHARACTER_CLASSES) {
      for (const branch of BRANCHES[cls]) {
        for (let tier = 1; tier <= 5; tier++) {
          const id = `${cls}.${branch}.${tier}`;
          const skill = getSkill(id);
          expect(skill, id).toBeDefined();
          expect(skill!.class).toBe(cls);
          expect(skill!.branch).toBe(branch);
          expect(skill!.tier).toBe(tier);
        }
      }
    }
  });

  it('indexes every skill by id', () => {
    expect(Object.keys(SKILLS_BY_ID)).toHaveLength(60);
    for (const s of SKILLS) expect(SKILLS_BY_ID[s.id]).toBe(s);
  });

  it('charges ember fragments only on tiers 4–5', () => {
    for (const s of SKILLS) {
      if (s.tier <= 3) expect(s.fragmentCost, s.id).toBe(0);
      else expect(s.fragmentCost, s.id).toBeGreaterThan(0);
    }
  });

  it('gives every active skill combat params and no passive one', () => {
    for (const s of SKILLS) {
      if (s.kind === 'active') expect(s.active, s.id).toBeDefined();
      else expect(s.active, s.id).toBeUndefined();
    }
  });

  it('exposes an identity modifier set', () => {
    expect(EMPTY_MODIFIERS.contributionMult).toBe(1);
    expect(EMPTY_MODIFIERS.armorPct).toBe(0);
    expect(EMPTY_MODIFIERS.blockFirstAttack).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aldenfer/shared test -- skills`
Expected: FAIL — cannot resolve `./skills.js`.

- [ ] **Step 3: Write `skills.ts` — types + `EMPTY_MODIFIERS` + full catalog**

Create `packages/shared/src/constants/skills.ts`. Define the interfaces from the Interfaces block above, then `EMPTY_MODIFIERS`, then the `SKILLS` array transcribing **GDD §5.1–5.4 verbatim** into `SkillDef`s. Rules for transcription:
- `tier` = position in the branch (1–5). `id` = `${class}.${branch}.${tier}`.
- `kind`: `'active'` for abilities used as the combat turn action (e.g. Frappe lourde, Fente, Tourbillon, Brise-garde, Exécution, all arcanist ashlight/veil damage/control spells, all scout hunt shots, cantor verse abilities); `'passive'` for stat/utility modifiers (Garde ferme, Endurci, Porteur, Pas léger, Longue-Vue, Poche double, Offrande, Veilleur…).
- `wiredInM3`: `true` when the effect touches combat / search / movement / vision / inventory / death-loss / contribution (see SPEC-M3 compatibility table); `false` for group / raid / craft / teleport / merchant effects (Provocation, Meneur, Chœur des Premiers, Alchimie, Transmutation, Œil des Archives, Chemins de traverse, Légende de Cendrelune, Écho de la Flamme, Pèlerin, Rallumeur, Cadence, Chant vivifiant, Répons, Hymne de fer, Verbe d'extinction, Injonction, Prison de verre if group-only, etc.).
- `fragmentCost`: `0` for tier ≤ 3; tier 4 = `1`, tier 5 = `2`.
- `modifiers`: for wired passives, the matching `SkillModifiers` field. Worked examples:
  ```ts
  // blade.bulwark.1 — Garde ferme : +10 % armure
  { id: 'blade.bulwark.1', class: 'blade', branch: 'bulwark', tier: 1, kind: 'passive',
    wiredInM3: true, fragmentCost: 0, modifiers: { armorPct: 10 } },
  // blade.veteran.2 — Porteur : +10 emplacements
  { id: 'blade.veteran.2', class: 'blade', branch: 'veteran', tier: 2, kind: 'passive',
    wiredInM3: true, fragmentCost: 0, modifiers: { inventoryBonus: 10 } },
  // scout.shadow.1 — Poche double : pertes à la mort −50 %
  { id: 'scout.shadow.1', class: 'scout', branch: 'shadow', tier: 1, kind: 'passive',
    wiredInM3: true, fragmentCost: 0, modifiers: { deathMaterialLossPct: 50 } },
  // cantor.ember.1 — Offrande : contributions ×1,4
  { id: 'cantor.ember.1', class: 'cantor', branch: 'ember', tier: 1, kind: 'passive',
    wiredInM3: true, fragmentCost: 0, modifiers: { contributionMult: 1.4 } },
  // arcanist.scholar.1 — Lecture des runes : fouilles +20 % de butin
  { id: 'arcanist.scholar.1', class: 'arcanist', branch: 'scholar', tier: 1, kind: 'passive',
    wiredInM3: true, fragmentCost: 0, modifiers: { searchLootPct: 20 } },
  // scout.travel.1 — Pas léger : timers −10 %
  { id: 'scout.travel.1', class: 'scout', branch: 'travel', tier: 1, kind: 'passive',
    wiredInM3: true, fragmentCost: 0, modifiers: { moveTimerPct: 10 } },
  ```
- `active`: for active skills. Worked examples:
  ```ts
  // blade.steel.1 — Frappe lourde : 130 %, cooldown 2 (matches STARTER_SKILLS)
  { id: 'blade.steel.1', class: 'blade', branch: 'steel', tier: 1, kind: 'active',
    wiredInM3: true, fragmentCost: 0,
    active: { multiplier: 1.3, cooldown: 2, damageKind: 'physical' } },
  // blade.steel.2 — Fente : ignore 25 % d'armure
  { id: 'blade.steel.2', class: 'blade', branch: 'steel', tier: 2, kind: 'active',
    wiredInM3: true, fragmentCost: 0,
    active: { multiplier: 1, cooldown: 1, damageKind: 'physical', ignoreArmorPct: 25 } },
  // scout.hunt.2 — Flèche barbelée : saignement 3 tours
  { id: 'scout.hunt.2', class: 'scout', branch: 'hunt', tier: 2, kind: 'active',
    wiredInM3: true, fragmentCost: 0,
    active: { multiplier: 1, cooldown: 2, damageKind: 'physical', bleedTurns: 3 } },
  ```
  For active skills whose gimmick needs an unbuilt system (Tourbillon = AoE, Provocation), set `wiredInM3: false` and give minimal `active` params (`{ multiplier: 1, cooldown: 1 }`) — they stay learnable but non-equippable (Task in the skills API enforces `wiredInM3 && kind==='active'` to equip).

Then:
```ts
export const SKILLS_BY_ID: Record<string, SkillDef> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
);
export function getSkill(id: string): SkillDef | undefined {
  return SKILLS_BY_ID[id];
}
```
Keep `STARTER_SKILLS` in `starter-gear.ts` consistent: `blade.steel.1`, `arcanist.ashlight.1`, `scout.hunt.1` must exist as active tier-1; `cantor.verse.2` (starter) must exist as active. Verify these five ids are in `SKILLS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aldenfer/shared test -- skills`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire the barrel export**

Add to `packages/shared/src/constants/index.ts`:
```ts
export * from './skills.js';
```

- [ ] **Step 6: Typecheck & commit**

Run: `pnpm --filter @aldenfer/shared build` (or `tsc --noEmit`) — Expected: no errors.
```bash
git add packages/shared/src/constants/skills.ts packages/shared/src/constants/skills.test.ts packages/shared/src/constants/index.ts
git commit -m "feat(shared): add M3 skill catalog (60 skills, GDD §5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `deriveSkillModifiers` reducer

**Files:**
- Create: `packages/shared/src/formulas/skills.ts`
- Test: `packages/shared/src/formulas/skills.test.ts`
- Modify: `packages/shared/src/formulas/index.ts` (add `export * from './skills.js';`)

**Interfaces:**
- Consumes: `SKILLS_BY_ID`, `EMPTY_MODIFIERS`, `SkillModifiers` from `../constants/skills.js`.
- Produces: `deriveSkillModifiers(learnedSkillIds: readonly string[]): SkillModifiers` — folds every learned **passive, `wiredInM3`** skill's `modifiers` onto `EMPTY_MODIFIERS`. Numeric fields add; `contributionMult` **multiplies** (product of all, base 1); booleans OR. Unknown ids and active skills are ignored.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/formulas/skills.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { deriveSkillModifiers } from './skills.js';

describe('deriveSkillModifiers', () => {
  it('returns identity for no skills', () => {
    const m = deriveSkillModifiers([]);
    expect(m.armorPct).toBe(0);
    expect(m.contributionMult).toBe(1);
    expect(m.blockFirstAttack).toBe(false);
  });

  it('adds numeric passive modifiers', () => {
    const m = deriveSkillModifiers(['blade.bulwark.1', 'blade.veteran.2']);
    expect(m.armorPct).toBe(10);      // Garde ferme
    expect(m.inventoryBonus).toBe(10); // Porteur
  });

  it('multiplies contributionMult', () => {
    const m = deriveSkillModifiers(['cantor.ember.1']);
    expect(m.contributionMult).toBeCloseTo(1.4);
  });

  it('ignores unknown ids and active skills', () => {
    const m = deriveSkillModifiers(['does.not.exist', 'blade.steel.1']);
    expect(m.armorPct).toBe(0);       // steel.1 is active → no passive modifier
  });

  it('sets deathMaterialLossPct from Poche double', () => {
    expect(deriveSkillModifiers(['scout.shadow.1']).deathMaterialLossPct).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aldenfer/shared test -- formulas/skills`
Expected: FAIL — cannot resolve `./skills.js`.

- [ ] **Step 3: Implement the reducer**

`packages/shared/src/formulas/skills.ts`:
```ts
import { EMPTY_MODIFIERS, SKILLS_BY_ID, type SkillModifiers } from '../constants/skills.js';

/** Aggregates the passive, M3-wired modifiers of the learned skills. Pure. */
export function deriveSkillModifiers(learnedSkillIds: readonly string[]): SkillModifiers {
  const acc: SkillModifiers = { ...EMPTY_MODIFIERS };
  for (const id of learnedSkillIds) {
    const skill = SKILLS_BY_ID[id];
    if (!skill || skill.kind !== 'passive' || !skill.wiredInM3 || !skill.modifiers) continue;
    const m = skill.modifiers;
    if (m.armorPct) acc.armorPct += m.armorPct;
    if (m.dodgePct) acc.dodgePct += m.dodgePct;
    if (m.searchLootPct) acc.searchLootPct += m.searchLootPct;
    if (m.moveTimerPct) acc.moveTimerPct += m.moveTimerPct;
    if (m.visionBonus) acc.visionBonus += m.visionBonus;
    if (m.inventoryBonus) acc.inventoryBonus += m.inventoryBonus;
    if (m.deathMaterialLossPct) acc.deathMaterialLossPct += m.deathMaterialLossPct;
    if (m.foeAshCrownsPct) acc.foeAshCrownsPct += m.foeAshCrownsPct;
    if (m.firstTurnDmgPct) acc.firstTurnDmgPct += m.firstTurnDmgPct;
    if (m.contributionMult) acc.contributionMult *= m.contributionMult;
    if (m.blockFirstAttack) acc.blockFirstAttack = true;
    if (m.fleeNoPenalty) acc.fleeNoPenalty = true;
  }
  return acc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aldenfer/shared test -- formulas/skills`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the barrel export & commit**

Add `export * from './skills.js';` to `packages/shared/src/formulas/index.ts`.
```bash
git add packages/shared/src/formulas/skills.ts packages/shared/src/formulas/skills.test.ts packages/shared/src/formulas/index.ts
git commit -m "feat(shared): derive passive skill modifiers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Economy formulas — `repairCost` & `contributionCredit`

**Files:**
- Create: `packages/shared/src/formulas/economy.ts`
- Test: `packages/shared/src/formulas/economy.test.ts`
- Modify: `packages/shared/src/formulas/index.ts` (add `export * from './economy.js';`)
- Modify: `packages/shared/src/constants/combat.ts` (add `DEATH_DURABILITY_LOSS = 10`, `BROKEN_GEAR_PENALTY = 0.5`) — verify these names aren't already taken.

**Interfaces:**
- Produces:
  - `repairCost(missingDurability: number, itemTier: number): number` — `ceil(missingDurability * REPAIR_COST_PER_POINT * tierFactor)`, where `REPAIR_COST_PER_POINT = 1` and `tierFactor = 1 + 0.5 * (itemTier - 1)` (t1 = ×1, t2 = ×1.5). Returns `0` when `missingDurability <= 0`.
  - `contributionCredit(qty: number, contributionMult: number): number` — `Math.floor(qty * contributionMult)`. The **debited** material stays `qty`; only the credited amount grows.
  - Constants `DEATH_DURABILITY_LOSS`, `BROKEN_GEAR_PENALTY`, `REPAIR_COST_PER_POINT` exported for the API.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/formulas/economy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { repairCost, contributionCredit } from './economy.js';

describe('repairCost', () => {
  it('is zero when nothing is missing', () => {
    expect(repairCost(0, 1)).toBe(0);
    expect(repairCost(-5, 2)).toBe(0);
  });
  it('scales per missing point for a tier-1 item', () => {
    expect(repairCost(40, 1)).toBe(40);
  });
  it('applies the tier factor', () => {
    expect(repairCost(40, 2)).toBe(60); // ×1.5
  });
  it('rounds up', () => {
    expect(repairCost(3, 2)).toBe(5);   // 3 × 1.5 = 4.5 → 5
  });
});

describe('contributionCredit', () => {
  it('is identity at ×1', () => {
    expect(contributionCredit(100, 1)).toBe(100);
  });
  it('applies the Offrande multiplier and floors', () => {
    expect(contributionCredit(100, 1.4)).toBe(140);
    expect(contributionCredit(3, 1.4)).toBe(4); // 4.2 → 4
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aldenfer/shared test -- formulas/economy`
Expected: FAIL — cannot resolve `./economy.js`.

- [ ] **Step 3: Implement the formulas & constants**

`packages/shared/src/formulas/economy.ts`:
```ts
export const REPAIR_COST_PER_POINT = 1;

/** Ash-crown cost to fully repair `missingDurability` points on a tier-`itemTier` item. Pure. */
export function repairCost(missingDurability: number, itemTier: number): number {
  if (missingDurability <= 0) return 0;
  const tierFactor = 1 + 0.5 * (itemTier - 1);
  return Math.ceil(missingDurability * REPAIR_COST_PER_POINT * tierFactor);
}

/** Amount credited to a community project for delivering `qty`, given the contribution multiplier. Pure. */
export function contributionCredit(qty: number, contributionMult: number): number {
  return Math.floor(qty * contributionMult);
}
```
Add to `packages/shared/src/constants/combat.ts`:
```ts
/** Durability lost by the equipped weapon and armour on each death (SPEC-M3 décision 2). */
export const DEATH_DURABILITY_LOSS = 10;
/** Equipment stats are multiplied by this when durability hits 0. */
export const BROKEN_GEAR_PENALTY = 0.5;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aldenfer/shared test -- formulas/economy`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire the barrel export & commit**

Add `export * from './economy.js';` to `packages/shared/src/formulas/index.ts`.
```bash
git add packages/shared/src/formulas/economy.ts packages/shared/src/formulas/economy.test.ts packages/shared/src/formulas/index.ts packages/shared/src/constants/combat.ts
git commit -m "feat(shared): repairCost & contributionCredit formulas + durability constants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Zod contracts — skills, chat, projects, market, WS envelope

**Files:**
- Create: `packages/shared/src/schemas/skill.ts`
- Create: `packages/shared/src/schemas/chat.ts`
- Create: `packages/shared/src/schemas/project.ts`
- Create: `packages/shared/src/schemas/market.ts`
- Create: `packages/shared/src/schemas/ws.ts`
- Test: `packages/shared/src/schemas/m3-contracts.test.ts`
- Modify: `packages/shared/src/schemas/character.ts` (add the `skills` field to `characterSchema`)
- Modify: `packages/shared/src/schemas/index.ts` (export the five new modules)

**Interfaces:**
- Consumes: `SKILLS` ids indirectly (validation is structural, not enum-locked, to keep schemas decoupled from the 60-entry list).
- Produces (types via `z.infer`):
  - `equipSkillsSchema = z.object({ slot1: z.string().nullish(), slot2: z.string().nullish() })`.
  - `learnSkillSchema = z.object({ skillId: z.string() })`.
  - `characterSkillSchema = z.object({ skillId: z.string(), equippedSlot: z.union([z.literal(1), z.literal(2)]).nullish() })`; `characterSchema` gains `skills: z.array(characterSkillSchema)`.
  - `chatChannelSchema = z.enum(['global', 'region:1'])` (M3 channels); `chatMessageSchema = z.object({ id, channel, characterId, characterName, body, at })`; `chatSendSchema = z.object({ type: z.literal('chat.send'), channel: chatChannelSchema, body: z.string().min(1).max(500) })`.
  - `RESOURCE_KEYS` reuse — resources validated by `z.enum` of the material ids: `['shadewood','sootOre','moorHerbs','mistbornHide','ashGlass','mistEssence']`.
  - `contributeSchema = z.object({ resource: resourceSchema, qty: z.number().int().positive() })`.
  - `projectSchema` (`{ id, name, goals: record, progress: record, completedAt: nullish }`), `projectDetailSchema` (extends with `myContribution: record`, `contributorCount: number`).
  - `createListingSchema = z.object({ itemId: z.string(), qty: z.number().int().positive(), unitPrice: z.number().int().positive() })`; `buyListingSchema = z.object({ qty: z.number().int().positive() })`; `listingSchema` (`{ id, sellerId, sellerName, itemId, qty, unitPrice, at }`).
  - `wsChannelSchema` (`character:{uuid}` | `region:{n}` | `global`), `wsServerEventSchema = z.object({ channel: z.string(), type: z.string(), data: z.unknown(), at: z.string() })`.

- [ ] **Step 1: Write the failing contract test**

`packages/shared/src/schemas/m3-contracts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { equipSkillsSchema, learnSkillSchema } from './skill.js';
import { chatSendSchema } from './chat.js';
import { contributeSchema } from './project.js';
import { createListingSchema, buyListingSchema } from './market.js';
import { wsServerEventSchema } from './ws.js';

describe('M3 contracts', () => {
  it('accepts a valid chat.send and rejects a >500 char body', () => {
    expect(chatSendSchema.safeParse({ type: 'chat.send', channel: 'global', body: 'salut' }).success).toBe(true);
    expect(chatSendSchema.safeParse({ type: 'chat.send', channel: 'region:1', body: 'x'.repeat(501) }).success).toBe(false);
    expect(chatSendSchema.safeParse({ type: 'chat.send', channel: 'region:9', body: 'y' }).success).toBe(false);
  });
  it('validates contribution resource & positive qty', () => {
    expect(contributeSchema.safeParse({ resource: 'shadewood', qty: 10 }).success).toBe(true);
    expect(contributeSchema.safeParse({ resource: 'gold', qty: 10 }).success).toBe(false);
    expect(contributeSchema.safeParse({ resource: 'shadewood', qty: 0 }).success).toBe(false);
  });
  it('validates market listing bodies', () => {
    expect(createListingSchema.safeParse({ itemId: 'weapon.blade.t1', qty: 1, unitPrice: 50 }).success).toBe(true);
    expect(createListingSchema.safeParse({ itemId: 'x', qty: 1, unitPrice: 0 }).success).toBe(false);
    expect(buyListingSchema.safeParse({ qty: 2 }).success).toBe(true);
  });
  it('allows null equip slots (unequip)', () => {
    expect(equipSkillsSchema.safeParse({ slot1: null, slot2: 'blade.steel.1' }).success).toBe(true);
    expect(learnSkillSchema.safeParse({ skillId: 'blade.bulwark.2' }).success).toBe(true);
  });
  it('accepts a server event envelope', () => {
    expect(wsServerEventSchema.safeParse({ channel: 'region:1', type: 'project.progress', data: {}, at: '2026-07-06T00:00:00Z' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aldenfer/shared test -- m3-contracts`
Expected: FAIL — cannot resolve the new modules.

- [ ] **Step 3: Write the five schema modules**

Create each file per the Interfaces block. `packages/shared/src/schemas/project.ts` (holds resource enum + project + contribute):
```ts
import { z } from 'zod';

export const RESOURCE_KEYS = ['shadewood', 'sootOre', 'moorHerbs', 'mistbornHide', 'ashGlass', 'mistEssence'] as const;
export const resourceSchema = z.enum(RESOURCE_KEYS);
export type ResourceKey = z.infer<typeof resourceSchema>;

export const contributeSchema = z.object({ resource: resourceSchema, qty: z.number().int().positive() });

const goalRecord = z.record(resourceSchema, z.number().int().nonnegative());
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  goals: goalRecord,
  progress: goalRecord,
  completedAt: z.iso.datetime().nullish(),
});
export const projectDetailSchema = projectSchema.extend({
  myContribution: goalRecord,
  contributorCount: z.number().int().nonnegative(),
});
export type ProjectDto = z.infer<typeof projectSchema>;
export type ProjectDetailDto = z.infer<typeof projectDetailSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
```
`chat.ts`:
```ts
import { z } from 'zod';
export const chatChannelSchema = z.enum(['global', 'region:1']);
export const chatMessageSchema = z.object({
  id: z.uuid(), channel: chatChannelSchema, characterId: z.uuid(),
  characterName: z.string(), body: z.string().min(1).max(500), at: z.iso.datetime(),
});
export const chatSendSchema = z.object({
  type: z.literal('chat.send'), channel: chatChannelSchema, body: z.string().min(1).max(500),
});
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
export type ChatSendInput = z.infer<typeof chatSendSchema>;
```
`skill.ts`:
```ts
import { z } from 'zod';
export const learnSkillSchema = z.object({ skillId: z.string() });
export const equipSkillsSchema = z.object({
  slot1: z.string().nullish(), slot2: z.string().nullish(),
});
export const characterSkillSchema = z.object({
  skillId: z.string(),
  equippedSlot: z.union([z.literal(1), z.literal(2)]).nullish(),
});
export type LearnSkillInput = z.infer<typeof learnSkillSchema>;
export type EquipSkillsInput = z.infer<typeof equipSkillsSchema>;
export type CharacterSkillDto = z.infer<typeof characterSkillSchema>;
```
`market.ts`:
```ts
import { z } from 'zod';
export const createListingSchema = z.object({
  itemId: z.string(), qty: z.number().int().positive(), unitPrice: z.number().int().positive(),
});
export const buyListingSchema = z.object({ qty: z.number().int().positive() });
export const listingSchema = z.object({
  id: z.uuid(), sellerId: z.uuid(), sellerName: z.string(),
  itemId: z.string(), qty: z.number().int().positive(), unitPrice: z.number().int().positive(),
  at: z.iso.datetime(),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type BuyListingInput = z.infer<typeof buyListingSchema>;
export type ListingDto = z.infer<typeof listingSchema>;
```
`ws.ts`:
```ts
import { z } from 'zod';
import { chatSendSchema } from './chat.js';
export const wsClientMessageSchema = chatSendSchema; // only chat.send in M3
export const wsServerEventSchema = z.object({
  channel: z.string(), type: z.string(), data: z.unknown(), at: z.string(),
});
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;
export type WsServerEvent = z.infer<typeof wsServerEventSchema>;
```
Extend `characterSchema` in `character.ts` — import `characterSkillSchema` and add before the closing `})`:
```ts
  skills: z.array(characterSkillSchema),
```
(add `import { characterSkillSchema } from './skill.js';` at top).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aldenfer/shared test -- m3-contracts`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire barrel exports, typecheck & commit**

Add to `packages/shared/src/schemas/index.ts`:
```ts
export * from './skill.js';
export * from './chat.js';
export * from './project.js';
export * from './market.js';
export * from './ws.js';
```
Run: `pnpm --filter @aldenfer/shared build` — Expected: no type errors (note: adding `skills` to `characterSchema` may surface API build errors later; those are handled in the DB/API tasks of the next plan).
```bash
git add packages/shared/src/schemas/
git commit -m "feat(shared): M3 Zod contracts (skills, chat, projects, market, WS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: French content — skill names/descriptions & new error messages

**Files:**
- Create: `packages/shared/src/content/fr/skills.ts`
- Test: `packages/shared/src/content/fr/skills.test.ts`
- Modify: `packages/shared/src/schemas/error.ts` (add the 6 new codes to the `ERROR_CODES` array — **required first**, since `ERROR_MESSAGES_FR` is typed `Record<ErrorCode, string>` and won't compile otherwise)
- Modify: `packages/shared/src/content/fr/errors.ts` (add the 6 matching messages)
- Modify: `packages/shared/src/content/fr/index.ts` (add `export * from './skills.js';`)

**Interfaces:**
- Consumes: `SKILLS` from `../../constants/skills.js`.
- Produces: `SKILL_CONTENT_FR: Record<string, { name: string; description: string }>` keyed by skill id (60 entries), names/descriptions from GDD §5 in the game's voice (tutoiement). Error messages for `INSUFFICIENT_MATERIALS`, `SKILL_ALREADY_LEARNED`, `CANNOT_BUY_OWN_LISTING`, `LISTING_UNAVAILABLE`, `PROJECT_COMPLETED`, `NOTHING_TO_REPAIR`.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/content/fr/skills.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SKILLS } from '../../constants/skills.js';
import { SKILL_CONTENT_FR } from './skills.js';

describe('French skill content', () => {
  it('has a name & description for every skill', () => {
    for (const s of SKILLS) {
      const c = SKILL_CONTENT_FR[s.id];
      expect(c, s.id).toBeDefined();
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
  it('has no orphan content keys', () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    for (const key of Object.keys(SKILL_CONTENT_FR)) expect(ids.has(key), key).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aldenfer/shared test -- content/fr/skills`
Expected: FAIL — cannot resolve `./skills.js`.

- [ ] **Step 3: Write the content**

`packages/shared/src/content/fr/skills.ts` — transcribe GDD §5 names, write one-line descriptions in the game's voice. Examples:
```ts
export const SKILL_CONTENT_FR: Record<string, { name: string; description: string }> = {
  'blade.bulwark.1': { name: 'Garde ferme', description: 'Ton armure gagne 10 %. Tiens bon.' },
  'blade.steel.1': { name: 'Frappe lourde', description: 'Un coup à 130 % des dégâts. Recharge 2 tours.' },
  'blade.steel.2': { name: 'Fente', description: 'Ta lame ignore 25 % de l’armure adverse.' },
  'scout.shadow.1': { name: 'Poche double', description: 'Tu ne perds plus que la moitié de tes matériaux en mourant.' },
  'cantor.ember.1': { name: 'Offrande', description: 'Tes contributions aux chantiers comptent pour 1,4×.' },
  // … 60 entries total, one per skill in SKILLS
};
```
First add the six codes to the `ERROR_CODES` array in `packages/shared/src/schemas/error.ts` (after `NO_ACTIVE_COMBAT`):
```ts
  'INSUFFICIENT_MATERIALS',
  'SKILL_ALREADY_LEARNED',
  'CANNOT_BUY_OWN_LISTING',
  'LISTING_UNAVAILABLE',
  'PROJECT_COMPLETED',
  'NOTHING_TO_REPAIR',
```
Then add the six matching strings to `ERROR_MESSAGES_FR` in `errors.ts`:
```ts
INSUFFICIENT_MATERIALS: 'Il te manque des matériaux pour cela.',
SKILL_ALREADY_LEARNED: 'Tu maîtrises déjà cette compétence.',
CANNOT_BUY_OWN_LISTING: 'Tu ne peux pas acheter ta propre annonce.',
LISTING_UNAVAILABLE: 'Cette annonce n’est plus disponible.',
PROJECT_COMPLETED: 'Ce chantier est déjà achevé.',
NOTHING_TO_REPAIR: 'Cet équipement est déjà en parfait état.',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aldenfer/shared test -- content/fr/skills`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the barrel export, run the full suite & commit**

Add `export * from './skills.js';` to `packages/shared/src/content/fr/index.ts`.
Run: `pnpm --filter @aldenfer/shared test` — Expected: all tests pass (M1/M2 + new M3).
Run: `pnpm --filter @aldenfer/shared build` — Expected: no errors.
```bash
git add packages/shared/src/content/fr/ packages/shared/src/schemas/error.ts
git commit -m "feat(shared): French skill content + M3 error messages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (SPEC-M3 step 1 = shared foundation):**
- 60-skill catalog → Task 1. `deriveSkillModifiers` → Task 2. `repairCost`, `contributionCredit` → Task 3. Zod contracts (chat/project/market/skills/WS) → Task 4. FR content (skills, errors) → Task 5. ✅ Every step-1 deliverable is covered.
- `effect↔wiredInM3` compatibility table → encoded as `SkillDef.wiredInM3` (Task 1). ✅
- Durability constants (`DEATH_DURABILITY_LOSS`, `BROKEN_GEAR_PENALTY`) → Task 3, consumed by the API durability task in the next plan. ✅
- Out of this slice (next plans): DB migration/seed, WS plugin, chat/project/market/skills/durability APIs, web. Correctly deferred — this plan produces a self-contained, vitest-green `shared` package.

**Placeholder scan:** The 60-skill data and 60 FR entries are explicit transcription tasks bound by a green invariant test (Task 1 asserts count/shape/tiers; Task 5 asserts full coverage) — the gate is a passing test, not prose. No "TBD"/"handle edge cases". ✅

**Type consistency:** `SkillModifiers`, `SkillDef`, `ActiveSkillParams` defined in Task 1 and consumed by Tasks 2/3; `characterSkillSchema` defined in Task 4 `skill.ts` and imported by `character.ts` in the same task. `contributionMult` multiplies (Task 2) matching `contributionCredit(qty, mult)` (Task 3). ✅

---

## Notes for subsequent M3 plans (not part of this slice)

Ordered per SPEC-M3 §Ordre d'implémentation, one plan each:
2. DB migration (`learnedSkills`, `equippedSkills` on `characters`) + activate `projects`/`contributions`/`market_listings`/`chat_messages` + seed `r1.belfry` & Q5.
3. WS plugin + `ConnectionRegistry` + auth upgrade + emit-after-commit.
4. Chat API (history + `chat.send` + rate-limit) + wire existing `character`/`region` emissions.
5. Projects/contributions + Q5 completion hook + rewards.
6. Market API.
7. Skills API (learn/equip) + combat/search/movement/death effect integration.
8. Durability on death + repair.
9. Web: `RealtimeService` + chat + chantier + market + skill tree + repair.
