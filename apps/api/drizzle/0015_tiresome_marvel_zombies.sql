CREATE TABLE "seo_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "seo_singleton" CHECK ("seo_settings"."id" = 1),
	CONSTRAINT "seo_version_positive" CHECK ("seo_settings"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;diff --git a/apps/api/drizzle/meta/0015_snapshot.json b/apps/api/drizzle/meta/0015_snapshot.json
