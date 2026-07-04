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
