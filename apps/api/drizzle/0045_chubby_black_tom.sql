CREATE TABLE "bonus_window_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bonus_window_singleton" CHECK ("bonus_window_settings"."id" = 1),
	CONSTRAINT "bonus_window_version_positive" CHECK ("bonus_window_settings"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "daily_claims" ADD COLUMN "kind" text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_claims" ADD CONSTRAINT "daily_claim_kind_valid" CHECK ("daily_claims"."kind" in ('daily','window'));