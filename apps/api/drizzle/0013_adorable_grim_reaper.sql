CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug"),
	CONSTRAINT "game_version_positive" CHECK ("games"."version" > 0),
	CONSTRAINT "game_slug_supported" CHECK ("games"."slug" in ('flip7'))
);
