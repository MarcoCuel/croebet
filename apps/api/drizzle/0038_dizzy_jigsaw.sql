ALTER TABLE "games" ADD COLUMN "module_id" text;--> statement-breakpoint
UPDATE "games" SET "module_id" = CASE WHEN "slug" IN ('flip7','love-letter') THEN "slug" ELSE gen_random_uuid()::text END;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "module_id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "module_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_module_id_unique" UNIQUE("module_id");
