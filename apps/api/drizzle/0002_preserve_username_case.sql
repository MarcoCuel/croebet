ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_check";--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_case_insensitive_unique" ON "users" USING btree (lower("username"));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_check" CHECK ("users"."username" ~ '^[A-Za-z0-9._]{3,24}$');