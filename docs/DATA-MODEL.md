# DATA-MODEL.md — Schéma PostgreSQL (Drizzle ORM)

Version anglaise et de référence du schéma (remplace la version française du GDD §15). Fichier cible : `apps/api/src/db/schema.ts`. Conventions : `timestamptz` partout, `snake_case` en base / `camelCase` en TS, contenu statique (quêtes, objets, compétences) identifié par slug, entités vivantes par UUID.

## Principes

1. **Pas de tick par joueur** : `stamina` + `stamina_updated_at` recalculés à la lecture ; actions à `ends_at` résolues paresseusement + worker.
2. **Colonnes pour le requêtable, JSONB pour le contenu** (effets, étapes, logs) — JSONB toujours validé par un schéma Zod de `shared` avant écriture.
3. **La DB est le dernier rempart** : contraintes CHECK/UNIQUE sur tout invariant critique.

```ts
import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  text,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────
export const classEnum = pgEnum('class', ['blade', 'arcanist', 'scout', 'cantor']);
export const terrainEnum = pgEnum('terrain', [
  'plain',
  'forest',
  'hill',
  'marsh',
  'ruins',
  'ash_road',
  'ford',
  'shrine',
]);
export const actionTypeEnum = pgEnum('action_type', [
  'move',
  'search',
  'rest',
  'craft',
  'raid_assault',
  'expedition_leg',
]);
export const questStateEnum = pgEnum('quest_state', ['available', 'active', 'done', 'failed']);
export const rarityEnum = pgEnum('rarity', ['common', 'rare', 'ember', 'relic']);
export const combatStatusEnum = pgEnum('combat_status', ['active', 'won', 'lost', 'fled']);
export const raidStatusEnum = pgEnum('raid_status', ['open', 'won', 'failed']);

// ─── World ────────────────────────────────────────────────────────────
export const regions = pgTable(
  'regions',
  {
    id: integer('id').primaryKey(), // 0 = Cinderlune Bastion
    slug: varchar('slug', { length: 32 }).notNull().unique(),
    unlocked: boolean('unlocked').notNull().default(false),
    mistLevel: integer('mist_level').notNull().default(3), // 0..3
    emberLit: boolean('ember_lit').notNull().default(false),
  },
  (t) => [check('mist_range', sql`${t.mistLevel} BETWEEN 0 AND 3`)],
);

export const hexes = pgTable(
  'hexes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
    q: integer('q').notNull(),
    r: integer('r').notNull(), // axial coords
    terrain: terrainEnum('terrain').notNull(),
    mistDelta: integer('mist_delta').notNull().default(0), // local offset vs region
    poiType: varchar('poi_type', { length: 24 }), // null = no POI
    poiData: jsonb('poi_data'), // loot table ref, quest hooks
  },
  (t) => [uniqueIndex('hex_coord_uq').on(t.regionId, t.q, t.r)],
);

// ─── Characters ───────────────────────────────────────────────────────
export const characters = pgTable(
  'characters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().unique(), // better-auth user.id
    name: varchar('name', { length: 24 }).notNull().unique(),
    class: classEnum('class').notNull(),
    level: integer('level').notNull().default(1),
    xp: integer('xp').notNull().default(0),
    str: integer('str').notNull(),
    dex: integer('dex').notNull(),
    wil: integer('wil').notNull(),
    vit: integer('vit').notNull(),
    fer: integer('fer').notNull(),
    attributePoints: integer('attribute_points').notNull().default(0),
    skillPoints: integer('skill_points').notNull().default(0),
    hp: integer('hp').notNull(),
    stamina: integer('stamina').notNull().default(100),
    staminaUpdatedAt: timestamp('stamina_updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deathPenaltyUntil: timestamp('death_penalty_until', { withTimezone: true }),
    hexId: uuid('hex_id')
      .notNull()
      .references(() => hexes.id),
    ashCrowns: integer('ash_crowns').notNull().default(0),
    emberFragments: integer('ember_fragments').notNull().default(0),
    gloryMarks: integer('glory_marks').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('stamina_range', sql`${t.stamina} BETWEEN 0 AND 100`),
    check(
      'currencies_positive',
      sql`${t.ashCrowns} >= 0 AND ${t.emberFragments} >= 0 AND ${t.gloryMarks} >= 0`,
    ),
  ],
);

// Fog of war
export const discoveries = pgTable(
  'discoveries',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    hexId: uuid('hex_id')
      .notNull()
      .references(() => hexes.id),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
    sharedToArchive: boolean('shared_to_archive').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.hexId] })],
);

// Action queue (max 3 / character — enforced in service + partial unique below)
export const actionQueue = pgTable(
  'action_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    type: actionTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull(), // Zod: ActionPayloadSchema
    position: integer('position').notNull(), // 0..2
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    resolved: boolean('resolved').notNull().default(false),
    result: jsonb('result'), // filled on resolution
  },
  (t) => [
    index('aq_due_idx').on(t.resolved, t.endsAt),
    uniqueIndex('aq_slot_uq')
      .on(t.characterId, t.position)
      .where(sql`resolved = false`),
  ],
);

// ─── Content: skills & items (static, seeded) ────────────────────────
export const skills = pgTable('skills', {
  id: varchar('id', { length: 40 }).primaryKey(), // "blade.bulwark.3"
  class: classEnum('class').notNull(),
  branch: varchar('branch', { length: 20 }).notNull(),
  tier: integer('tier').notNull(), // 1..5
  effect: jsonb('effect').notNull(), // Zod: SkillEffectSchema
  fragmentCost: integer('fragment_cost').notNull().default(0),
});
// Names/descriptions FR live in content files (i18n), not in DB.

export const characterSkills = pgTable(
  'character_skills',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    skillId: varchar('skill_id', { length: 40 })
      .notNull()
      .references(() => skills.id),
    equippedSlot: integer('equipped_slot'), // null | 1 | 2
  },
  (t) => [primaryKey({ columns: [t.characterId, t.skillId] })],
);

export const items = pgTable('items', {
  id: varchar('id', { length: 40 }).primaryKey(), // "weapon.blade.t2"
  kind: varchar('kind', { length: 20 }).notNull(), // weapon|armor|consumable|material|quest
  rarity: rarityEnum('rarity').notNull().default('common'),
  stats: jsonb('stats'),
  stackable: boolean('stackable').notNull().default(false),
  maxDurability: integer('max_durability'),
});

export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    itemId: varchar('item_id', { length: 40 })
      .notNull()
      .references(() => items.id),
    qty: integer('qty').notNull().default(1),
    equipped: boolean('equipped').notNull().default(false),
    durability: integer('durability'),
  },
  (t) => [index('inv_char_idx').on(t.characterId), check('qty_positive', sql`${t.qty} > 0`)],
);

// ─── Combat (persisted — survives app close) ─────────────────────────
export const combats = pgTable(
  'combats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    foeSlug: varchar('foe_slug', { length: 40 }).notNull(),
    raidId: uuid('raid_id').references(() => raids.id), // null = regular encounter
    foeHp: integer('foe_hp').notNull(),
    foeHpMax: integer('foe_hp_max').notNull(),
    playerHp: integer('player_hp').notNull(),
    turn: integer('turn').notNull().default(1),
    cooldowns: jsonb('cooldowns').notNull().default({}),
    log: jsonb('log').notNull().default([]),
    status: combatStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('combat_active_uq')
      .on(t.characterId)
      .where(sql`status = 'active'`),
  ],
);

// ─── Quests ───────────────────────────────────────────────────────────
export const quests = pgTable('quests', {
  id: varchar('id', { length: 40 }).primaryKey(), // "r1.main.q3"
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  kind: varchar('kind', { length: 16 }).notNull(), // main|side|daily
  steps: jsonb('steps').notNull(), // Zod: QuestGraphSchema (branching)
  rewards: jsonb('rewards').notNull(),
  requires: jsonb('requires'), // prior quest, level…
});

export const characterQuests = pgTable(
  'character_quests',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    questId: varchar('quest_id', { length: 40 })
      .notNull()
      .references(() => quests.id),
    state: questStateEnum('state').notNull().default('active'),
    stepId: varchar('step_id', { length: 24 }).notNull(),
    progress: jsonb('progress'), // counters, branch choices
  },
  (t) => [primaryKey({ columns: [t.characterId, t.questId] })],
);

// ─── Community: projects & raids ──────────────────────────────────────
export const projects = pgTable('projects', {
  id: varchar('id', { length: 40 }).primaryKey(), // "r1.belfry"
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  goals: jsonb('goals').notNull(), // { shadewood: 5000, ... }
  progress: jsonb('progress').notNull().default({}),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: varchar('project_id', { length: 40 })
      .notNull()
      .references(() => projects.id),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    resource: varchar('resource', { length: 24 }).notNull(),
    qty: integer('qty').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contrib_proj_idx').on(t.projectId), check('contrib_qty', sql`${t.qty} > 0`)],
);

export const raids = pgTable('raids', {
  id: uuid('id').defaultRandom().primaryKey(),
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  bossSlug: varchar('boss_slug', { length: 40 }).notNull(),
  hpMax: bigint('hp_max', { mode: 'number' }).notNull(),
  hpCurrent: bigint('hp_current', { mode: 'number' }).notNull(),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  status: raidStatusEnum('status').notNull().default('open'),
});

export const raidAssaults = pgTable(
  'raid_assaults',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    raidId: uuid('raid_id')
      .notNull()
      .references(() => raids.id),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    combatId: uuid('combat_id')
      .notNull()
      .references(() => combats.id),
    damage: integer('damage').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assault_raid_idx').on(t.raidId, t.characterId)],
);

// ─── Market ───────────────────────────────────────────────────────────
export const marketListings = pgTable(
  'market_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => characters.id),
    itemId: varchar('item_id', { length: 40 })
      .notNull()
      .references(() => items.id),
    qty: integer('qty').notNull(),
    unitPrice: integer('unit_price').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('market_item_idx').on(t.itemId, t.unitPrice),
    check('listing_positive', sql`${t.qty} > 0 AND ${t.unitPrice} > 0`),
  ],
);

// ─── Social ───────────────────────────────────────────────────────────
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 32 }).notNull().unique(),
  leaderId: uuid('leader_id')
    .notNull()
    .references(() => characters.id),
  charter: text('charter'),
});

export const companyMembers = pgTable(
  'company_members',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id)
      .unique(),
    role: varchar('role', { length: 12 }).notNull().default('member'),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.characterId] })],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channel: varchar('channel', { length: 48 }).notNull(), // global | region:1 | company:<uuid>
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    body: varchar('body', { length: 500 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_chan_idx').on(t.channel, t.createdAt)],
);

// ─── Push (PWA) ───────────────────────────────────────────────────────
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  characterId: uuid('character_id')
    .notNull()
    .references(() => characters.id),
  subscription: jsonb('subscription').notNull(), // Web Push payload
  preferences: jsonb('preferences').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

## Seed

`apps/api/src/db/seed/` — idempotent (`ON CONFLICT DO NOTHING` / upsert par slug) :

1. `regions.ts` — régions 0–3 (0 et 1 `unlocked`).
2. `hexes.ts` — région 0 (7 hexes) + région 1 (45 hexes) : données déclaratives `{q, r, terrain, poiType?}` reprises de la maquette et étendues.
3. `skills.ts` — 60 compétences (GDD §5, IDs du GLOSSARY).
4. `items.ts` — set de départ : 4 armes t1, 4 t2, armures t1, potions, 6 matériaux.
5. `quests.ts` — chaîne r1.main.q1→q6 + 4 annexes (GDD §10).
6. `projects.ts` — `r1.belfry`.

Contenu FR (noms, descriptions, dialogues) : fichiers JSON dans `packages/shared/src/content/fr/` servis par `GET /content/*` — la DB ne stocke jamais de texte affichable.
