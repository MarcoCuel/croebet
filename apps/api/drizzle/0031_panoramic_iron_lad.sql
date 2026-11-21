ALTER TABLE "game_match_players" ADD COLUMN "lobby_offline_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "lobby_expires_at" timestamp with time zone DEFAULT now() + interval '32 minutes' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "lobby_offline_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "lobby_closed_reason" text;