CREATE TYPE "public"."action_type" AS ENUM('move', 'search', 'rest', 'craft', 'raid_assault', 'expedition_leg');--> statement-breakpoint
CREATE TYPE "public"."class" AS ENUM('blade', 'arcanist', 'scout', 'cantor');--> statement-breakpoint
CREATE TYPE "public"."terrain" AS ENUM('plain', 'forest', 'hill', 'marsh', 'ruins', 'ash_road', 'ford', 'shrine');--> statement-breakpoint
CREATE TABLE "action_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"type" "action_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"position" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(24) NOT NULL,
	"class" "class" NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"str" integer NOT NULL,
	"dex" integer NOT NULL,
	"wil" integer NOT NULL,
	"vit" integer NOT NULL,
	"fer" integer NOT NULL,
	"attribute_points" integer DEFAULT 0 NOT NULL,
	"skill_points" integer DEFAULT 0 NOT NULL,
	"hp" integer NOT NULL,
	"stamina" integer DEFAULT 100 NOT NULL,
	"stamina_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"death_penalty_until" timestamp with time zone,
	"hex_id" uuid NOT NULL,
	"ash_crowns" integer DEFAULT 0 NOT NULL,
	"ember_fragments" integer DEFAULT 0 NOT NULL,
	"glory_marks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "characters_name_unique" UNIQUE("name"),
	CONSTRAINT "stamina_range" CHECK ("characters"."stamina" BETWEEN 0 AND 100),
	CONSTRAINT "currencies_positive" CHECK ("characters"."ash_crowns" >= 0 AND "characters"."ember_fragments" >= 0 AND "characters"."glory_marks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "discoveries" (
	"character_id" uuid NOT NULL,
	"hex_id" uuid NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shared_to_archive" boolean DEFAULT false NOT NULL,
	CONSTRAINT "discoveries_character_id_hex_id_pk" PRIMARY KEY("character_id","hex_id")
);
--> statement-breakpoint
CREATE TABLE "hexes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_id" integer NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"terrain" "terrain" NOT NULL,
	"mist_delta" integer DEFAULT 0 NOT NULL,
	"poi_type" varchar(24),
	"poi_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY NOT NULL,
	"slug" varchar(32) NOT NULL,
	"unlocked" boolean DEFAULT false NOT NULL,
	"mist_level" integer DEFAULT 3 NOT NULL,
	"ember_lit" boolean DEFAULT false NOT NULL,
	CONSTRAINT "regions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "mist_range" CHECK ("regions"."mist_level" BETWEEN 0 AND 3)
);
--> statement-breakpoint
ALTER TABLE "action_queue" ADD CONSTRAINT "action_queue_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_hex_id_hexes_id_fk" FOREIGN KEY ("hex_id") REFERENCES "public"."hexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_hex_id_hexes_id_fk" FOREIGN KEY ("hex_id") REFERENCES "public"."hexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hexes" ADD CONSTRAINT "hexes_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aq_due_idx" ON "action_queue" USING btree ("resolved","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "aq_slot_uq" ON "action_queue" USING btree ("character_id","position") WHERE resolved = false;--> statement-breakpoint
CREATE UNIQUE INDEX "hex_coord_uq" ON "hexes" USING btree ("q","r");