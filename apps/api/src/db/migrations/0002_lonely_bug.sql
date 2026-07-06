CREATE TYPE "public"."combat_status" AS ENUM('active', 'won', 'lost', 'fled');--> statement-breakpoint
CREATE TYPE "public"."quest_state" AS ENUM('available', 'active', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."rarity" AS ENUM('common', 'rare', 'ember', 'relic');--> statement-breakpoint
CREATE TABLE "character_quests" (
	"character_id" uuid NOT NULL,
	"quest_id" varchar(40) NOT NULL,
	"state" "quest_state" DEFAULT 'active' NOT NULL,
	"step_id" varchar(24) NOT NULL,
	"progress" jsonb,
	CONSTRAINT "character_quests_character_id_quest_id_pk" PRIMARY KEY("character_id","quest_id")
);
--> statement-breakpoint
CREATE TABLE "combats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"foe_slug" varchar(40) NOT NULL,
	"foe_hp" integer NOT NULL,
	"foe_hp_max" integer NOT NULL,
	"player_hp" integer NOT NULL,
	"turn" integer DEFAULT 1 NOT NULL,
	"cooldowns" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "combat_status" DEFAULT 'active' NOT NULL,
	"rewards" jsonb,
	"quest_id" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"item_id" varchar(40) NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"durability" integer,
	CONSTRAINT "qty_positive" CHECK ("inventory"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"rarity" "rarity" DEFAULT 'common' NOT NULL,
	"stats" jsonb,
	"stackable" boolean DEFAULT false NOT NULL,
	"max_durability" integer
);
--> statement-breakpoint
CREATE TABLE "poi_searches" (
	"character_id" uuid NOT NULL,
	"hex_id" uuid NOT NULL,
	"searched_on" varchar(10) NOT NULL,
	CONSTRAINT "poi_searches_character_id_hex_id_searched_on_pk" PRIMARY KEY("character_id","hex_id","searched_on")
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"region_id" integer NOT NULL,
	"kind" varchar(16) NOT NULL,
	"steps" jsonb NOT NULL,
	"rewards" jsonb NOT NULL,
	"requires" jsonb
);
--> statement-breakpoint
ALTER TABLE "character_quests" ADD CONSTRAINT "character_quests_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_quests" ADD CONSTRAINT "character_quests_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combats" ADD CONSTRAINT "combats_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poi_searches" ADD CONSTRAINT "poi_searches_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poi_searches" ADD CONSTRAINT "poi_searches_hex_id_hexes_id_fk" FOREIGN KEY ("hex_id") REFERENCES "public"."hexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "combat_active_uq" ON "combats" USING btree ("character_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "inv_char_idx" ON "inventory" USING btree ("character_id");