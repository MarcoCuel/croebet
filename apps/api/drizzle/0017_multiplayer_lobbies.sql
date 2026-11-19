-- The discarded local-seat prototype has no production data to preserve.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM game_matches) THEN
  IF NOT EXISTS (SELECT 1 FROM application_environment WHERE id=1 AND environment IN ('development','test')) THEN
   RAISE EXCEPTION 'Refusing to discard matches outside development/test';
  END IF;
  TRUNCATE game_matches CASCADE;
 END IF;
END $$;--> statement-breakpoint
ALTER TABLE "game_matches" DROP CONSTRAINT "match_status";--> statement-breakpoint
DROP INDEX "match_command_once";--> statement-breakpoint
DROP INDEX "match_creation_request";--> statement-breakpoint
ALTER TABLE "game_matches" ALTER COLUMN "state" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_match_commands" ADD COLUMN "actor_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "game_match_players" ADD COLUMN "joined_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "capacity" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "options" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "game_match_commands" ADD CONSTRAINT "game_match_commands_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_member" ON "game_match_players" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_command_once" ON "game_match_commands" USING btree ("match_id","actor_id","command_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_creation_request" ON "game_matches" USING btree ("created_by","creation_request_id");--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "match_capacity" CHECK ("game_matches"."capacity" between 2 and 12);--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "match_status" CHECK ("game_matches"."status" in ('lobby','playing','finished','abandoned'));