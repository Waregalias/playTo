# M3 Projects & Contributions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The community chantier — `GET /projects`, `GET /projects/:id`, and `POST /projects/:id/contribute` (⚡5, transaction: debit materials, clamp to the remaining goal, apply the Offrande ×1,4 credit, grant XP + écus, broadcast `project.progress` throttled 10 s). When the belfry hits 100 %, mark it complete idempotently, complete quest **Q5 « Sonner le Glas »** for every contributor, and announce it globally. This is the milestone's exit criterion.

**Architecture:** The clamp/credit maths is a pure `planContribution` in `shared` (tested in isolation). Q5 gains a new `project` quest step kind; completion reuses the existing `completeStep` engine. Contribution runs in one transaction; the route publishes `project.progress` (leading-edge throttle, reusing `SlidingWindowRateLimiter(1, 10_000)`) after commit, and `announce` on completion.

**Tech Stack:** Drizzle, Zod, Fastify, Vitest. Reuses `app.realtime` (plan 3), `completeStep`/`grantRewards` (M2 quest engine), `applyXp` (progression).

## Global Constraints

- Le serveur fait autorité ; **transaction** autour du débit inventaire + progression + monnaies + endurance.
- Contribution : ⚡5, instantané. **Clamp** au restant du goal ; surplus non débité ; ⚡ prélevée seulement si ≥1 unité créditée (SPEC-M3 décision 1).
- Offrande (`cantor.ember.1`) ×1,4 sur le **crédit**, pas sur le débit matériel.
- Complétion Q5 : idempotente (`WHERE completed_at IS NULL`), Q5 → `done` pour **tout contributeur ayant une Q5 active** sur l'étape `project`, récompenses distribuées, `announce` global.
- `project.progress` diffusé sur `region:{regionId}`, throttlé 10 s ; toujours diffusé à la complétion.
- Aucune chaîne FR en dur ; erreurs via `content/fr/errors.ts` (codes déjà ajoutés au plan fondation).
- Vérif : `pnpm --filter @aldenfer/shared test`, `pnpm --filter api test`, builds `tsc --noEmit`.
- Hors périmètre : création du raid Maugrith à la complétion (M4).

---

### Task 1: shared — contribution maths & constants

**Files:**
- Create: `packages/shared/src/formulas/contribution.ts`
- Test: `packages/shared/src/formulas/contribution.test.ts`
- Modify: `packages/shared/src/formulas/index.ts` (export)
- Create: `packages/shared/src/constants/resources.ts` (resource→itemId map + stamina cost)
- Modify: `packages/shared/src/constants/index.ts` (export)

**Interfaces:**
- Produces:
  ```ts
  export interface ContributionPlan { creditGiven: number; rawNeeded: number; }
  export function planContribution(qty: number, mult: number, remaining: number): ContributionPlan;
  export function contributionReward(credit: number): { xp: number; ashCrowns: number };
  // constants/resources.ts
  export const CONTRIBUTION_STAMINA_COST = 5; // GDD §8
  export const RESOURCE_ITEM_IDS: Record<string, string>; // 'shadewood' -> 'material.shadewood'
  ```

- [ ] **Step 1: Write the failing tests**

`packages/shared/src/formulas/contribution.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { planContribution, contributionReward } from './contribution.js';

describe('planContribution', () => {
  it('debits and credits 1:1 without a multiplier', () => {
    expect(planContribution(50, 1, 5000)).toEqual({ creditGiven: 50, rawNeeded: 50 });
  });
  it('clamps the credit to the remaining goal and debits only what is needed', () => {
    expect(planContribution(100, 1, 10)).toEqual({ creditGiven: 10, rawNeeded: 10 });
  });
  it('applies the Offrande multiplier to the credit, not the debit', () => {
    expect(planContribution(100, 1.4, 5000)).toEqual({ creditGiven: 140, rawNeeded: 100 });
  });
  it('with a multiplier near completion, debits fewer raw units', () => {
    expect(planContribution(100, 1.4, 50)).toEqual({ creditGiven: 50, rawNeeded: 36 });
  });
  it('is a no-op when nothing remains or qty is zero', () => {
    expect(planContribution(100, 1.4, 0)).toEqual({ creditGiven: 0, rawNeeded: 0 });
    expect(planContribution(0, 1, 100)).toEqual({ creditGiven: 0, rawNeeded: 0 });
  });
});

describe('contributionReward', () => {
  it('grants 1 XP per credit and 1 écu per 5 credit', () => {
    expect(contributionReward(50)).toEqual({ xp: 50, ashCrowns: 10 });
    expect(contributionReward(3)).toEqual({ xp: 3, ashCrowns: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @aldenfer/shared test contribution` → FAIL.

- [ ] **Step 3: Implement**

`packages/shared/src/formulas/contribution.ts`:
```ts
export interface ContributionPlan {
  /** Amount added to the project progress for this resource. */
  creditGiven: number;
  /** Raw material units actually removed from the inventory. */
  rawNeeded: number;
}

/** Clamp + Offrande maths for one contribution. Pure. `remaining` is goal − progress. */
export function planContribution(qty: number, mult: number, remaining: number): ContributionPlan {
  if (qty <= 0 || remaining <= 0) return { creditGiven: 0, rawNeeded: 0 };
  const creditWanted = Math.floor(qty * mult);
  const creditGiven = Math.min(creditWanted, remaining);
  const rawNeeded = Math.min(qty, Math.ceil(creditGiven / mult));
  return { creditGiven, rawNeeded };
}

/** Contributor XP + ash-crown reward for a given credited amount. Pure. */
export function contributionReward(credit: number): { xp: number; ashCrowns: number } {
  return { xp: credit, ashCrowns: Math.floor(credit / 5) };
}
```
`packages/shared/src/constants/resources.ts`:
```ts
/** Endurance cost of one contribution (GDD §8). */
export const CONTRIBUTION_STAMINA_COST = 5;

/** Maps a project resource key (GLOSSARY) to its inventory item id. */
export const RESOURCE_ITEM_IDS: Record<string, string> = {
  shadewood: 'material.shadewood',
  sootOre: 'material.soot-ore',
  moorHerbs: 'material.moor-herbs',
  mistbornHide: 'material.mistborn-hide',
  ashGlass: 'material.ash-glass',
  mistEssence: 'material.mist-essence',
};
```
Add exports: `export * from './contribution.js';` to `formulas/index.ts`; `export * from './resources.js';` to `constants/index.ts`.

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @aldenfer/shared test contribution` → PASS. Then `pnpm --filter @aldenfer/shared build` → clean.

- [ ] **Step 5: Commit**
```bash
git add packages/shared/src/formulas/contribution.ts packages/shared/src/formulas/contribution.test.ts packages/shared/src/formulas/index.ts packages/shared/src/constants/resources.ts packages/shared/src/constants/index.ts
git commit -m "feat(shared): contribution clamp/credit maths + resource map"
```

---

### Task 2: shared — `project` quest step, Q5 data, contribute response schema & FR

**Files:**
- Modify: `packages/shared/src/schemas/quest.ts` (add `project` step kind + handle in types)
- Modify: `packages/shared/src/schemas/project.ts` (add `contributeResponseSchema`)
- Modify: `packages/shared/src/constants/quest-data.ts` (add Q5)
- Modify: `packages/shared/src/content/fr/quests.ts` (Q5 name/description — inspect the file's shape first)
- Test: `packages/shared/src/constants/quest-data.test.ts` (create or extend — verify Q5 present & graph valid)

**Interfaces:**
- Produces: quest step `{ kind:'project', projectId: string, next: string | null }`; `QUEST_DEFINITIONS` includes `r1.main.q5` (kind main, requires `r1.main.q4`, one project step → next null); `contributeResponseSchema = z.object({ project: projectDetailSchema, character: characterSchema })`.

- [ ] **Step 1: Add the `project` step kind (write failing shared test first)**

Create `packages/shared/src/constants/quest-data.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { QUEST_DEFINITIONS } from './quest-data.js';
import { questGraphSchema } from '../schemas/quest.js';

describe('Q5 community project quest', () => {
  it('defines r1.main.q5 requiring q4 with a project step', () => {
    const q5 = QUEST_DEFINITIONS.find((q) => q.id === 'r1.main.q5');
    expect(q5).toBeDefined();
    expect(q5!.requires).toMatchObject({ quest: 'r1.main.q4' });
    const graph = questGraphSchema.parse({ start: q5!.steps.start, steps: q5!.steps.steps });
    const step = graph.steps.find((s) => s.kind === 'project');
    expect(step).toBeDefined();
  });
});
```
Run `pnpm --filter @aldenfer/shared test quest-data` → FAIL. Then in `packages/shared/src/schemas/quest.ts`, add to the `questStepSchema` discriminated union (after the `combat` member):
```ts
  z.object({ ...stepBase, kind: z.literal('project'), projectId: z.string() }),
```

- [ ] **Step 2: Add the `contributeResponseSchema`**

In `packages/shared/src/schemas/project.ts`, add (imports `characterSchema` from `./character.js`):
```ts
import { characterSchema } from './character.js';
// …
export const contributeResponseSchema = z.object({
  project: projectDetailSchema,
  character: characterSchema,
});
export type ContributeResponse = z.infer<typeof contributeResponseSchema>;
```

- [ ] **Step 3: Add Q5 to the quest data**

Inspect `packages/shared/src/constants/quest-data.ts` for the `RAW_QUESTS` array shape (see q4 at the end), then append a Q5 entry mirroring that shape:
```ts
  {
    id: 'r1.main.q5',
    regionId: 1,
    kind: 'main',
    requires: { quest: 'r1.main.q4' },
    rewards: { xp: 400, emberFragments: 2 },
    steps: {
      start: 's1',
      steps: [{ id: 's1', kind: 'project', projectId: 'r1.belfry', next: null }],
    },
  },
```
(Match the exact field names/nesting the file uses — e.g. if steps are stored as `{ start, steps }` per q4, follow that; the `requires`/`rewards` keys are per `QuestDefinition`.)

- [ ] **Step 4: FR content for Q5**

Inspect `packages/shared/src/content/fr/quests.ts` and add the Q5 entry in the same shape as q1–q4 (name « Sonner le Glas », a short lore description in the game's voice, and any step label the structure expects).

- [ ] **Step 5: Run tests, typecheck & commit**

Run `pnpm --filter @aldenfer/shared test` → all pass (quest-data + existing). Run `pnpm --filter @aldenfer/shared build` → clean.
```bash
git add packages/shared/src/schemas/quest.ts packages/shared/src/schemas/project.ts packages/shared/src/constants/quest-data.ts packages/shared/src/constants/quest-data.test.ts packages/shared/src/content/fr/quests.ts
git commit -m "feat(shared): project quest step + Q5 « Sonner le Glas » + contribute response"
```

---

### Task 3: api — inventory debit, project service, routes, broadcast & completion

**Files:**
- Modify: `apps/api/src/modules/inventory/service.ts` (add `removeMaterialQty`)
- Modify: `apps/api/src/modules/quests/hooks.ts` (handle `project` kind in `stepMatches`)
- Create: `apps/api/src/modules/projects/service.ts`
- Create: `apps/api/src/modules/projects/routes.ts`
- Test: `apps/api/src/modules/projects/routes.test.ts`
- Modify: `apps/api/src/app.ts` (register project routes)
- Modify: `apps/api/src/test/test-db.ts` (seed `projects` so `r1.belfry` exists in tests)

**Interfaces:**
- Consumes: `planContribution`, `contributionReward`, `CONTRIBUTION_STAMINA_COST`, `RESOURCE_ITEM_IDS`, `computeStamina`, `applyXp`, `completeStep`, `app.realtime`.
- Produces:
  ```ts
  // inventory/service.ts
  export async function removeMaterialQty(tx: Tx, characterId: string, itemId: string, qty: number): Promise<boolean>;
  // projects/service.ts
  export async function listProjects(db: Db, regionId?: number): Promise<{ items: ProjectDto[] }>;
  export async function getProjectDetail(db: Db, projectId: string, characterId: string): Promise<ProjectDetailDto>;
  export async function contribute(
    db: Db, character: CharacterRow, projectId: string, input: { resource: string; qty: number }, now: Date,
  ): Promise<{ detail: ProjectDetailDto; character: CharacterDto; completed: boolean; credited: boolean; regionId: number }>;
  ```

- [ ] **Step 1: `removeMaterialQty` (write failing test first)**

Add to `apps/api/src/modules/inventory/service.ts`:
```ts
/** Debits `qty` of a stackable material; returns false (no change) if the stack is too small. */
export async function removeMaterialQty(
  tx: Tx,
  characterId: string,
  itemId: string,
  qty: number,
): Promise<boolean> {
  const row = await tx.query.inventory.findFirst({
    where: and(eq(inventory.characterId, characterId), eq(inventory.itemId, itemId)),
  });
  if (!row || row.qty < qty) return false;
  if (row.qty === qty) {
    await tx.delete(inventory).where(eq(inventory.id, row.id));
  } else {
    await tx.update(inventory).set({ qty: row.qty - qty }).where(eq(inventory.id, row.id));
  }
  return true;
}
```
(Its behaviour is covered by the contribution tests in Step 6 — no separate unit test needed since it has no branching logic beyond the guard, which the `INSUFFICIENT_MATERIALS` case exercises.)

- [ ] **Step 2: Handle `project` in `stepMatches`**

In `apps/api/src/modules/quests/hooks.ts`, add a case so the discriminated union stays exhaustive (project steps never advance on world events — only on project completion):
```ts
    case 'project':
      return false;
```

- [ ] **Step 3: Seed the project in the test DB**

In `apps/api/src/test/test-db.ts`: import `projects` from schema and `PROJECT_SEEDS` from `../db/seed/projects-data.js`, and after the quests insert add:
```ts
  await db
    .insert(projects)
    .values(PROJECT_SEEDS.map((p) => ({ id: p.id, regionId: p.regionId, name: p.name, goals: p.goals })))
    .onConflictDoNothing();
```

- [ ] **Step 4: Write the failing API test**

`apps/api/src/modules/projects/routes.test.ts` (reuse `signUp` + setup pattern; add a materials-granting helper and a direct `characters`/`inventory`/`projects` writer via `db`). Cover: happy contribute, clamp, INSUFFICIENT_STAMINA, INSUFFICIENT_MATERIALS, PROJECT_COMPLETED, completion → Q5 done + `announce` published, and `project.progress` published. Key cases:
```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../../test/test-db.js';
import { characters, inventory, projects, characterQuests } from '../../db/schema.js';
import type { Db } from '../../db/client.js';

let app: FastifyInstance; let db: Db;
const NOW = new Date('2026-07-04T12:00:00Z');
// signUp copied from characters/routes.test.ts

async function makeChar(cookie: string, name: string, cls = 'blade') {
  await app.inject({ method: 'POST', url: '/api/v1/characters', headers: { cookie }, payload: { name, class: cls } });
  return (await db.query.characters.findFirst({ where: eq(characters.name, name) }))!;
}
async function giveMaterial(characterId: string, itemId: string, qty: number) {
  await db.insert(inventory).values({ characterId, itemId, qty });
}

beforeAll(async () => { db = await setupTestDb(); app = await buildApp(TEST_ENV, { db, now: () => NOW }); await app.ready(); });
afterAll(async () => { await app.close(); });
beforeEach(async () => {
  await resetTestDb(db);
  // reset live project progress between tests
  await db.update(projects).set({ progress: {}, completedAt: null }).where(eq(projects.id, 'r1.belfry'));
});

describe('POST /api/v1/projects/:id/contribute', () => {
  it('debits materials, credits progress, XP, écus and 5 stamina', async () => {
    const cookie = await signUp('c1@aldenfer.test');
    const char = await makeChar(cookie, 'Giver');
    await giveMaterial(char.id, 'material.shadewood', 100);

    const res = await app.inject({ method: 'POST', url: '/api/v1/projects/r1.belfry/contribute', headers: { cookie }, payload: { resource: 'shadewood', qty: 50 } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project.progress.shadewood).toBe(50);
    expect(body.project.myContribution.shadewood).toBe(50);
    expect(body.character.stamina).toBe(95);
    const inv = await db.query.inventory.findFirst({ where: eq(inventory.characterId, char.id) });
    expect(inv!.qty).toBe(50);
  });

  it('clamps to the remaining goal and debits only what is needed', async () => {
    const cookie = await signUp('c2@aldenfer.test');
    const char = await makeChar(cookie, 'Clamper');
    await db.update(projects).set({ progress: { shadewood: 4990 } }).where(eq(projects.id, 'r1.belfry'));
    await giveMaterial(char.id, 'material.shadewood', 100);

    const res = await app.inject({ method: 'POST', url: '/api/v1/projects/r1.belfry/contribute', headers: { cookie }, payload: { resource: 'shadewood', qty: 100 } });
    expect(res.json().project.progress.shadewood).toBe(5000);
    const inv = await db.query.inventory.findFirst({ where: eq(inventory.characterId, char.id) });
    expect(inv!.qty).toBe(90); // only 10 debited
  });

  it('rejects when the material is missing (409 INSUFFICIENT_MATERIALS)', async () => {
    const cookie = await signUp('c3@aldenfer.test');
    await makeChar(cookie, 'Empty');
    const res = await app.inject({ method: 'POST', url: '/api/v1/projects/r1.belfry/contribute', headers: { cookie }, payload: { resource: 'shadewood', qty: 10 } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_MATERIALS');
  });

  it('rejects when stamina is below 5 (409 INSUFFICIENT_STAMINA)', async () => {
    const cookie = await signUp('c4@aldenfer.test');
    const char = await makeChar(cookie, 'Tired');
    await db.update(characters).set({ stamina: 4, staminaUpdatedAt: NOW }).where(eq(characters.id, char.id));
    await giveMaterial(char.id, 'material.shadewood', 10);
    const res = await app.inject({ method: 'POST', url: '/api/v1/projects/r1.belfry/contribute', headers: { cookie }, payload: { resource: 'shadewood', qty: 10 } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_STAMINA');
  });

  it('completes the belfry: Q5 done for the contributor + announce', async () => {
    const cookie = await signUp('c5@aldenfer.test');
    const char = await makeChar(cookie, 'Finisher');
    // near-complete, only 1 ash glass missing
    await db.update(projects).set({ progress: { shadewood: 5000, sootOre: 3000, ashGlass: 499 } }).where(eq(projects.id, 'r1.belfry'));
    await giveMaterial(char.id, 'material.ash-glass', 1);
    // contributor has Q5 active on the project step
    await db.insert(characterQuests).values({ characterId: char.id, questId: 'r1.main.q5', state: 'active', stepId: 's1', progress: { counts: {}, choices: {} } });

    const publishSpy = vi.spyOn(app.realtime, 'publish');
    const res = await app.inject({ method: 'POST', url: '/api/v1/projects/r1.belfry/contribute', headers: { cookie }, payload: { resource: 'ashGlass', qty: 1 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().project.completedAt).not.toBeNull();

    const cq = await db.query.characterQuests.findFirst({ where: eq(characterQuests.characterId, char.id) });
    expect(cq!.state).toBe('done');
    expect(publishSpy.mock.calls.some((c) => c[0] === 'global' && c[1] === 'announce')).toBe(true);
    publishSpy.mockRestore();
  });

  it('rejects contributing to a completed project (409 PROJECT_COMPLETED)', async () => {
    const cookie = await signUp('c6@aldenfer.test');
    const char = await makeChar(cookie, 'Late');
    await db.update(projects).set({ completedAt: NOW }).where(eq(projects.id, 'r1.belfry'));
    await giveMaterial(char.id, 'material.shadewood', 10);
    const res = await app.inject({ method: 'POST', url: '/api/v1/projects/r1.belfry/contribute', headers: { cookie }, payload: { resource: 'shadewood', qty: 10 } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROJECT_COMPLETED');
  });
});
```

- [ ] **Step 5: Run to verify it fails** — `pnpm --filter api test projects` → FAIL (service/route missing).

- [ ] **Step 6: Implement the service**

`apps/api/src/modules/projects/service.ts`:
```ts
import { and, eq, sql } from 'drizzle-orm';
import {
  planContribution,
  contributionReward,
  contributionCredit,
  deriveSkillModifiers,
  CONTRIBUTION_STAMINA_COST,
  RESOURCE_ITEM_IDS,
  computeStamina,
  questGraphSchema,
  questProgressSchema,
  type ProjectDto,
  type ProjectDetailDto,
  type CharacterDto,
} from '@aldenfer/shared';
import type { Db } from '../../db/client.js';
import { characters, contributions, hexes, projects, characterQuests, quests } from '../../db/schema.js';
import { AppError } from '../../lib/app-error.js';
import { applyXp } from '../../lib/progression.js';
import { removeMaterialQty } from '../inventory/service.js';
import { regenContextFor, toCharacterDto } from '../characters/service.js';
import { completeStep } from '../quests/hooks.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type CharacterRow = typeof characters.$inferSelect;

function toProjectDto(row: typeof projects.$inferSelect): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    goals: row.goals,
    progress: row.progress,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function listProjects(db: Db, regionId?: number): Promise<{ items: ProjectDto[] }> {
  const rows = regionId === undefined
    ? await db.select().from(projects)
    : await db.select().from(projects).where(eq(projects.regionId, regionId));
  return { items: rows.map(toProjectDto) };
}

async function contributionSummary(tx: Tx | Db, projectId: string, characterId: string) {
  const rows = await tx
    .select({ characterId: contributions.characterId, resource: contributions.resource, qty: contributions.qty })
    .from(contributions)
    .where(eq(contributions.projectId, projectId));
  const mine: Record<string, number> = {};
  const contributors = new Set<string>();
  for (const r of rows) {
    contributors.add(r.characterId);
    if (r.characterId === characterId) mine[r.resource] = (mine[r.resource] ?? 0) + r.qty;
  }
  return { myContribution: mine, contributorCount: contributors.size };
}

export async function getProjectDetail(db: Db, projectId: string, characterId: string): Promise<ProjectDetailDto> {
  const row = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!row) throw new AppError('NOT_FOUND', 404);
  const summary = await contributionSummary(db, projectId, characterId);
  return { ...toProjectDto(row), ...summary };
}

/** Completes any active `project` quest at this project's step for every contributor. */
async function completeProjectQuests(tx: Tx, projectId: string): Promise<void> {
  const contributorRows = await tx
    .selectDistinct({ characterId: contributions.characterId })
    .from(contributions)
    .where(eq(contributions.projectId, projectId));
  for (const { characterId } of contributorRows) {
    const active = await tx
      .select({ cq: characterQuests, quest: quests })
      .from(characterQuests)
      .innerJoin(quests, eq(characterQuests.questId, quests.id))
      .where(and(eq(characterQuests.characterId, characterId), eq(characterQuests.state, 'active')));
    for (const { cq, quest } of active) {
      const graph = questGraphSchema.parse(quest.steps);
      const step = graph.steps.find((s) => s.id === cq.stepId);
      if (!step || step.kind !== 'project' || step.projectId !== projectId) continue;
      const progress = questProgressSchema.parse(cq.progress ?? { counts: {}, choices: {} });
      await completeStep(tx, characterId, quest.id, graph, step, progress, step.next);
    }
  }
}

export async function contribute(
  db: Db,
  character: CharacterRow,
  projectId: string,
  input: { resource: string; qty: number },
  now: Date,
): Promise<{ detail: ProjectDetailDto; character: CharacterDto; completed: boolean; credited: boolean; regionId: number }> {
  const itemId = RESOURCE_ITEM_IDS[input.resource];
  if (!itemId) throw new AppError('VALIDATION_ERROR', 400);

  const result = await db.transaction(async (tx) => {
    const [proj] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update');
    if (!proj) throw new AppError('NOT_FOUND', 404);
    if (proj.completedAt) throw new AppError('PROJECT_COMPLETED', 409);

    const goal = proj.goals[input.resource] ?? 0;
    const current = proj.progress[input.resource] ?? 0;
    const remaining = goal - current;

    const [charRow] = await tx.select().from(characters).where(eq(characters.id, character.id)).for('update');
    if (!charRow) throw new Error('character vanished');
    const hex = await tx.query.hexes.findFirst({ where: eq(hexes.id, charRow.hexId) });
    const staminaNow = computeStamina(
      { stamina: charRow.stamina, staminaUpdatedAt: charRow.staminaUpdatedAt },
      now,
      hex ? regenContextFor(hex) : 'field',
    );

    const mult = deriveSkillModifiers(charRow.learnedSkills).contributionMult;
    const plan = planContribution(input.qty, mult, remaining);

    let completed = false;
    if (plan.creditGiven > 0) {
      if (staminaNow.stamina < CONTRIBUTION_STAMINA_COST) {
        throw new AppError('INSUFFICIENT_STAMINA', 409, {
          required: CONTRIBUTION_STAMINA_COST,
          current: staminaNow.stamina,
        });
      }
      const debited = await removeMaterialQty(tx, character.id, itemId, plan.rawNeeded);
      if (!debited) throw new AppError('INSUFFICIENT_MATERIALS', 409);

      const newProgress = { ...proj.progress, [input.resource]: current + plan.creditGiven };
      await tx.update(projects).set({ progress: newProgress }).where(eq(projects.id, projectId));
      await tx.insert(contributions).values({ projectId, characterId: character.id, resource: input.resource, qty: plan.rawNeeded });

      const reward = contributionReward(plan.creditGiven);
      const xp = applyXp(charRow, reward.xp);
      await tx
        .update(characters)
        .set({
          stamina: staminaNow.stamina - CONTRIBUTION_STAMINA_COST,
          staminaUpdatedAt: staminaNow.staminaUpdatedAt,
          xp: xp.xp,
          level: xp.level,
          attributePoints: xp.attributePoints,
          skillPoints: xp.skillPoints,
          ashCrowns: charRow.ashCrowns + reward.ashCrowns,
        })
        .where(eq(characters.id, character.id));

      // completion check against every goal
      const goalsMet = Object.entries(proj.goals).every(([k, g]) => (newProgress[k] ?? 0) >= g);
      if (goalsMet) {
        const [claimed] = await tx
          .update(projects)
          .set({ completedAt: now })
          .where(and(eq(projects.id, projectId), sql`${projects.completedAt} IS NULL`))
          .returning();
        if (claimed) {
          completed = true;
          await completeProjectQuests(tx, projectId);
        }
      }
    }

    const freshChar = (await tx.select().from(characters).where(eq(characters.id, character.id)))[0]!;
    const freshHex = await tx.query.hexes.findFirst({ where: eq(hexes.id, freshChar.hexId) });
    const detail = await (async () => {
      const p = (await tx.select().from(projects).where(eq(projects.id, projectId)))[0]!;
      const summary = await contributionSummary(tx, projectId, character.id);
      return { ...toProjectDto(p), ...summary };
    })();

    return {
      detail,
      character: toCharacterDto(freshChar, freshHex!, now),
      completed,
      credited: plan.creditGiven > 0,
      regionId: proj.regionId,
    };
  });

  return result;
}
```

- [ ] **Step 7: Implement the routes (with broadcast)**

`apps/api/src/modules/projects/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  contributeSchema,
  contributeResponseSchema,
  projectSchema,
  projectDetailSchema,
} from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { SlidingWindowRateLimiter } from '../../realtime/rate-limit.js';
import { listProjects, getProjectDetail, contribute } from './service.js';

export function registerProjectRoutes(app: FastifyInstance, auth: Auth, now: () => Date): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const progressThrottle = new SlidingWindowRateLimiter(1, 10_000); // leading-edge, per project

  typed.get(
    '/api/v1/projects',
    { schema: { querystring: z.object({ regionId: z.coerce.number().int().optional() }), response: { 200: z.object({ items: z.array(projectSchema) }) } } },
    async (request) => {
      await requireCharacter(app.db, auth, request);
      return listProjects(app.db, request.query.regionId);
    },
  );

  typed.get(
    '/api/v1/projects/:id',
    { schema: { params: z.object({ id: z.string() }), response: { 200: projectDetailSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return getProjectDetail(app.db, request.params.id, character.id);
    },
  );

  typed.post(
    '/api/v1/projects/:id/contribute',
    { schema: { params: z.object({ id: z.string() }), body: contributeSchema, response: { 200: contributeResponseSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      const out = await contribute(app.db, character, request.params.id, request.body, now());
      if (out.credited) {
        const at = now().toISOString();
        if (out.completed || progressThrottle.tryConsume(request.params.id, now().getTime())) {
          app.realtime.publish(`region:${out.regionId}`, 'project.progress', {
            projectId: request.params.id, progress: out.detail.progress, goals: out.detail.goals,
          }, at);
        }
        if (out.completed) {
          app.realtime.publish('global', 'announce', {
            kind: 'project.completed', projectId: request.params.id,
          }, at);
        }
      }
      return { project: out.detail, character: out.character };
    },
  );
}
```
Wire in `apps/api/src/app.ts`: import `registerProjectRoutes` and call `registerProjectRoutes(app, auth, now);` alongside the others (before `registerRealtime`).

- [ ] **Step 8: Run tests, typecheck & commit**

Run `pnpm --filter api test projects` → PASS (6 tests). Run `pnpm --filter api test` → all pass. Run `pnpm --filter api build` → clean.
```bash
git add apps/api/src/modules/inventory/service.ts apps/api/src/modules/quests/hooks.ts apps/api/src/modules/projects/ apps/api/src/app.ts apps/api/src/test/test-db.ts
git commit -m "feat(api): community project contributions + Q5 completion + progress broadcast"
```

---

## Self-Review

**Spec coverage (SPEC-M3 step 5 = projects/contributions + Q5):**
- `GET /projects`, `GET /projects/:id` (detail), `POST /projects/:id/contribute` → Task 3. ✅
- ⚡5, transaction, clamp, Offrande ×1,4, XP + écus → Tasks 1 (maths) + 3 (service). ✅
- Errors INSUFFICIENT_STAMINA / INSUFFICIENT_MATERIALS / PROJECT_COMPLETED → Task 3 tests. ✅
- Completion idempotent (`WHERE completed_at IS NULL`) → Task 3 service. ✅
- Q5 done for contributors + `announce` → Tasks 2 (Q5 + project step) + 3 (`completeProjectQuests`). ✅
- `project.progress` throttled 10 s, always on completion → Task 3 route (SlidingWindowRateLimiter(1,10_000)). ✅

**Placeholder scan:** Q5 quest-data / FR shapes say "inspect the file first" then give the concrete entry to mirror — the executor confirms field names against q4. All service/route/test code is complete. No "TBD". ✅

**Type consistency:** `planContribution(qty,mult,remaining)→{creditGiven,rawNeeded}` (Task 1) consumed verbatim by the service (Task 3). `contributeResponseSchema = {project: projectDetailSchema, character: characterSchema}` (Task 2) is the route's 200 and matches the `{project, character}` return. `RESOURCE_ITEM_IDS` keys match `RESOURCE_KEYS` (shared). `completeStep(tx, characterId, questId, graph, step, progress, next)` signature matches hooks.ts (M2). `project` step added to both the schema union (Task 2) and `stepMatches` (Task 3) — exhaustive. ✅

## Notes for subsequent M3 plans
- Interpretation of "Q5 achieved by a contributor": a contributor whose Q5 is **active** on the `project` step at completion time flips to `done`. Contributing without having accepted Q5 still counts materials but grants no quest completion — coherent with the quest engine (accept requires Q4). Documented for the web plan (chantier UI must let players accept Q5 then contribute).
- Web plan: `project.progress` and `announce` are **invalidation signals** (refetch `GET /projects/:id`), unlike `chat.message`.
