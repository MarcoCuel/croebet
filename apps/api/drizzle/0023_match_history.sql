CREATE TABLE "game_match_archive_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"event" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_match_archives" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"code" text NOT NULL,
	"rules_version" integer NOT NULL,
	"status" text NOT NULL,
	"options" jsonb NOT NULL,
	"participants" jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_match_archive_frames" ADD CONSTRAINT "game_match_archive_frames_match_id_game_match_archives_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."game_match_archives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_match_archives" ADD CONSTRAINT "game_match_archives_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_frame_version" ON "game_match_archive_frames" USING btree ("match_id","version");--> statement-breakpoint
CREATE INDEX "archive_game_started" ON "game_match_archives" USING btree ("game_id","started_at","id");--> statement-breakpoint
-- Archive public confirmed frames, never the private deck/RNG state. No user or
-- operational match FK: deleting an account/room must not erase this history.
CREATE FUNCTION archive_game_match() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  latest_state jsonb;
BEGIN
  IF NEW.status = 'lobby' THEN RETURN NEW; END IF;
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
CREATE TRIGGER archive_confirmed_match AFTER UPDATE ON game_matches
  FOR EACH ROW EXECUTE FUNCTION archive_game_match();
--> statement-breakpoint
CREATE FUNCTION close_deleted_match_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE game_match_archives SET status='abandoned',ended_at=clock_timestamp()
    WHERE id=OLD.id AND status='playing';
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER preserve_deleted_match_archive BEFORE DELETE ON game_matches
  FOR EACH ROW EXECUTE FUNCTION close_deleted_match_archive();
--> statement-breakpoint
-- Backfill existing histories without changing operational rows or their versions.
INSERT INTO game_match_archives(id,game_id,code,rules_version,status,options,participants,state,started_at,ended_at)
SELECT m.id,m.game_id,m.code,m.rules_version,m.status,m.options,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('seat',p.seat,'userId',p.user_id,'name',p.name) ORDER BY p.seat)
    FROM game_match_players p WHERE p.match_id=m.id),'[]'::jsonb),
  e.event->'state',m.created_at,CASE WHEN m.status IN ('finished','abandoned') THEN m.updated_at END
FROM game_matches m JOIN LATERAL
  (SELECT event FROM game_match_events WHERE match_id=m.id ORDER BY version DESC LIMIT 1) e ON true
WHERE m.status<>'lobby';
--> statement-breakpoint
INSERT INTO game_match_archive_frames(match_id,version,event)
SELECT e.match_id,e.version,e.event FROM game_match_events e JOIN game_match_archives a ON a.id=e.match_id;
