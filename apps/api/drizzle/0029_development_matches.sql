ALTER TABLE game_matches ADD COLUMN development boolean NOT NULL DEFAULT false, ADD COLUMN bots integer NOT NULL DEFAULT 0, ADD COLUMN only_bots boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE game_matches ADD CONSTRAINT test_economy CHECK (NOT development OR entry_amount=0), ADD CONSTRAINT test_bots CHECK (bots BETWEEN 0 AND 12 AND (development OR (bots=0 AND NOT only_bots)));
--> statement-breakpoint
CREATE FUNCTION protect_match_execution_mode() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.development<>OLD.development OR NEW.game_slug<>OLD.game_slug THEN RAISE EXCEPTION 'Match execution mode is immutable'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_match_execution_mode BEFORE UPDATE ON game_matches FOR EACH ROW EXECUTE FUNCTION protect_match_execution_mode();
--> statement-breakpoint
CREATE FUNCTION reject_test_stakes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM game_matches WHERE id=NEW.match_id AND development) THEN RAISE EXCEPTION 'Test matches cannot move currency'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER no_test_stakes BEFORE INSERT ON game_match_stakes FOR EACH ROW EXECUTE FUNCTION reject_test_stakes();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION archive_game_match() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  latest_state jsonb;
BEGIN
  IF NEW.development OR NEW.status = 'lobby' THEN RETURN NEW; END IF;
  SELECT event->'state' INTO latest_state FROM game_match_events
    WHERE match_id=NEW.id ORDER BY version DESC LIMIT 1;
  IF latest_state IS NULL THEN RETURN NEW; END IF;
  INSERT INTO game_match_archives(id,game_id,code,rules_version,status,options,participants,state,started_at,ended_at)
    VALUES(NEW.id,NEW.game_id,NEW.code,NEW.rules_version,NEW.status,NEW.options,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('seat',p.seat,'userId',p.user_id,'name',p.name) ORDER BY p.seat)
        FROM game_match_players p WHERE p.match_id=NEW.id),'[]'::jsonb),
      latest_state,clock_timestamp(),CASE WHEN NEW.status IN ('finished','abandoned') THEN NEW.updated_at END)
    ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,state=EXCLUDED.state,
      ended_at=COALESCE(game_match_archives.ended_at,EXCLUDED.ended_at)
      WHERE game_match_archives.status='playing';
  INSERT INTO game_match_archive_frames(match_id,version,event)
    SELECT match_id,version,event FROM game_match_events
      WHERE match_id=NEW.id AND version>COALESCE((SELECT max(version) FROM game_match_archive_frames WHERE match_id=NEW.id),0)
    ON CONFLICT(match_id,version) DO NOTHING;
  RETURN NEW;
END $$;

--> statement-breakpoint
INSERT INTO games(slug,name,description,enabled,image_url,version) VALUES('love-letter','Love Letter','Um jogo de dedução e cartas. Disponível em Clássico e Moderno.',true,null,1) ON CONFLICT(slug) DO NOTHING;
