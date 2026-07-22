import {
  pgTable,
  uuid,
  varchar,
  integer,
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

// better-auth tables (user, session, account, verification) — generated
// by @better-auth/cli, regenerate via apps/api/auth-cli-config.ts.
export * from './auth-schema.js';

// ─── Enums (DATA-MODEL.md) ────────────────────────────────────────────
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
  (t) => [uniqueIndex('hex_coord_uq').on(t.q, t.r)],
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
    learnedSkills: jsonb('learned_skills').$type<string[]>().notNull().default([]),
    equippedSkills: jsonb('equipped_skills')
      .$type<{ slot1?: string; slot2?: string }>()
      .notNull()
      .default({}),
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
    tutorialCompletedAt: timestamp('tutorial_completed_at', { withTimezone: true }),
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

// ─── Content: items (static, seeded) ─────────────────────────────────
export const items = pgTable('items', {
  id: varchar('id', { length: 40 }).primaryKey(), // "weapon.blade.t2"
  kind: varchar('kind', { length: 20 }).notNull(), // weapon|armor|consumable|material|quest
  rarity: rarityEnum('rarity').notNull().default('common'),
  stats: jsonb('stats'), // Zod: itemStatsSchema
  stackable: boolean('stackable').notNull().default(false),
  maxDurability: integer('max_durability'),
});
// Names/descriptions FR live in packages/shared content, not in DB.

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
// raidId arrives with the raids table in M4.
export const combats = pgTable(
  'combats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    foeSlug: varchar('foe_slug', { length: 40 }).notNull(),
    foeHp: integer('foe_hp').notNull(),
    foeHpMax: integer('foe_hp_max').notNull(),
    playerHp: integer('player_hp').notNull(),
    turn: integer('turn').notNull().default(1),
    cooldowns: jsonb('cooldowns').notNull().default({}),
    log: jsonb('log').notNull().default([]), // Zod: combatLogEntrySchema[]
    status: combatStatusEnum('status').notNull().default('active'),
    rewards: jsonb('rewards'), // Zod: combatRewardsSchema — filled on victory
    questId: varchar('quest_id', { length: 40 }), // scripted quest fight
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('combat_active_uq').on(t.characterId).where(sql`status = 'active'`)],
);

// ─── Quests ───────────────────────────────────────────────────────────
export const quests = pgTable('quests', {
  id: varchar('id', { length: 40 }).primaryKey(), // "r1.main.q3"
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  kind: varchar('kind', { length: 16 }).notNull(), // main|side|daily
  steps: jsonb('steps').notNull(), // Zod: questGraphSchema
  rewards: jsonb('rewards').notNull(), // Zod: questRewardsSchema
  requires: jsonb('requires'), // Zod: questRequiresSchema
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
    progress: jsonb('progress'), // Zod: questProgressSchema
  },
  (t) => [primaryKey({ columns: [t.characterId, t.questId] })],
);

// Daily search ledger (US4: one search per POI per day, midnight UTC)
export const poiSearches = pgTable(
  'poi_searches',
  {
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    hexId: uuid('hex_id')
      .notNull()
      .references(() => hexes.id),
    searchedOn: varchar('searched_on', { length: 10 }).notNull(), // YYYY-MM-DD (UTC)
  },
  (t) => [primaryKey({ columns: [t.characterId, t.hexId, t.searchedOn] })],
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
    uniqueIndex('aq_slot_uq').on(t.characterId, t.position).where(sql`resolved = false`),
  ],
);

// ─── Community: projects & contributions (M3) ─────────────────────────
export const projects = pgTable('projects', {
  id: varchar('id', { length: 40 }).primaryKey(), // "r1.belfry"
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  name: varchar('name', { length: 64 }).notNull(),
  goals: jsonb('goals').$type<Record<string, number>>().notNull(),
  progress: jsonb('progress').$type<Record<string, number>>().notNull().default({}),
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

// ─── Market: auction house (M3) ───────────────────────────────────────
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

// ─── Social: chat (M3 — global + region channels) ─────────────────────
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channel: varchar('channel', { length: 48 }).notNull(), // global | region:1
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id),
    body: varchar('body', { length: 500 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_chan_idx').on(t.channel, t.createdAt)],
);
