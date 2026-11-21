ALTER TABLE "users" ADD COLUMN "profile_name_provided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_remind_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "profile_name_provided" = true WHERE "display_name" <> "username";
