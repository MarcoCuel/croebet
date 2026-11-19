CREATE TABLE "avatar_cleanup" (
	"key" text PRIMARY KEY NOT NULL,
	"delete_after" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_key" text;