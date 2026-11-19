CREATE TABLE "game_match_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "match_invitation_other_user" CHECK ("game_match_invitations"."sender_id" <> "game_match_invitations"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_match_invitations" ADD CONSTRAINT "game_match_invitations_match_id_game_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."game_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_invitations" ADD CONSTRAINT "game_match_invitations_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_invitations" ADD CONSTRAINT "game_match_invitations_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_invitation_recipient" ON "game_match_invitations" USING btree ("match_id","recipient_id");--> statement-breakpoint
CREATE INDEX "match_invitations_inbox" ON "game_match_invitations" USING btree ("recipient_id");