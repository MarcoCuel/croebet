CREATE TABLE "match_presence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_presence" ADD CONSTRAINT "match_presence_match_id_game_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."game_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_presence" ADD CONSTRAINT "match_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_presence_room" ON "match_presence" USING btree ("match_id");