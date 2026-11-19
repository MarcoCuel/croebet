CREATE TABLE "game_match_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"response" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"event" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"user_id" uuid,
	"controller_id" uuid,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "match_seat_valid" CHECK ("game_match_players"."seat">=0),
	CONSTRAINT "match_player_kind" CHECK ("game_match_players"."kind" in ('user','guest','bot'))
);
--> statement-breakpoint
CREATE TABLE "game_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"game_id" uuid NOT NULL,
	"game_slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"rules_version" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"state" jsonb NOT NULL,
	"creation_request_id" uuid NOT NULL,
	"creation_hash" text NOT NULL,
	"creation_response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_matches_code_unique" UNIQUE("code"),
	CONSTRAINT "match_status" CHECK ("game_matches"."status" in ('playing','finished','abandoned')),
	CONSTRAINT "match_versions" CHECK ("game_matches"."version">0 and "game_matches"."rules_version">0)
);
--> statement-breakpoint
ALTER TABLE "game_match_commands" ADD CONSTRAINT "game_match_commands_match_id_game_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."game_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_events" ADD CONSTRAINT "game_match_events_match_id_game_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."game_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_players" ADD CONSTRAINT "game_match_players_match_id_game_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."game_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_players" ADD CONSTRAINT "game_match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_players" ADD CONSTRAINT "game_match_players_controller_id_users_id_fk" FOREIGN KEY ("controller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_command_once" ON "game_match_commands" USING btree ("match_id","command_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_event_version" ON "game_match_events" USING btree ("match_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "match_seat" ON "game_match_players" USING btree ("match_id","seat");--> statement-breakpoint
CREATE UNIQUE INDEX "match_creation_request" ON "game_matches" USING btree ("owner_id","creation_request_id");--> statement-breakpoint
CREATE INDEX "match_owner_status" ON "game_matches" USING btree ("owner_id","status");