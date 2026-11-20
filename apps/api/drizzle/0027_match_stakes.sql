CREATE TABLE "game_match_stakes" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"pot_account_id" uuid NOT NULL,
	"entry_amount" bigint NOT NULL,
	"pot_total" bigint NOT NULL,
	"contributions" jsonb NOT NULL,
	"payouts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "game_match_stakes_pot_account_id_unique" UNIQUE("pot_account_id"),
	CONSTRAINT "match_stake_status" CHECK ("game_match_stakes"."status" in ('pending','paid','refunded')),
	CONSTRAINT "match_stake_amounts" CHECK ("game_match_stakes"."entry_amount">0 and "game_match_stakes"."pot_total">="game_match_stakes"."entry_amount" and "game_match_stakes"."pot_total"<=9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "game_match_players" ADD COLUMN "confirmed_entry_amount" bigint;--> statement-breakpoint
ALTER TABLE "game_matches" ADD COLUMN "entry_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_match_stakes" ADD CONSTRAINT "game_match_stakes_pot_account_id_wallet_accounts_id_fk" FOREIGN KEY ("pot_account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_players" ADD CONSTRAINT "match_confirmation_range" CHECK ("game_match_players"."confirmed_entry_amount" is null or "game_match_players"."confirmed_entry_amount" between 1 and 9007199254740991);--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "match_entry_range" CHECK ("game_matches"."entry_amount" between 0 and 9007199254740991);--> statement-breakpoint
INSERT INTO wallet_accounts(id,kind) VALUES ('00000000-0000-4000-8000-000000000002','house') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Fail closed if a new deletion path forgets to settle/refund a funded room.
CREATE FUNCTION protect_pending_match_pot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM game_match_stakes WHERE match_id=OLD.id AND status='pending') THEN
    RAISE EXCEPTION 'Refund or settle the match pot before deleting the room';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER protect_pending_match_pot BEFORE DELETE ON game_matches FOR EACH ROW EXECUTE FUNCTION protect_pending_match_pot();
