ALTER TABLE "achievement_definitions" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD COLUMN "image_url" text DEFAULT '' NOT NULL;