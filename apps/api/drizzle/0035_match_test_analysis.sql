ALTER TABLE game_matches ADD COLUMN started_at timestamptz, ADD COLUMN ended_at timestamptz,
 ADD COLUMN playback_since timestamptz, ADD COLUMN playback_until timestamptz,
 ADD COLUMN playback_milliseconds bigint NOT NULL DEFAULT 0 CONSTRAINT match_playback_nonnegative CHECK (playback_milliseconds >= 0);
--> statement-breakpoint
UPDATE game_matches m SET started_at=a.started_at,ended_at=a.ended_at FROM game_match_archives a WHERE a.id=m.id;
--> statement-breakpoint
CREATE FUNCTION track_match_timing() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE at_time timestamptz := clock_timestamp();
BEGIN
 IF OLD.status='lobby' AND NEW.status IN ('playing','finished') THEN NEW.started_at=at_time; END IF;
 IF OLD.status='playing' AND NEW.status IN ('finished','abandoned') THEN
  NEW.ended_at=at_time;
  IF NEW.playback_since IS NOT NULL THEN
   NEW.playback_milliseconds=NEW.playback_milliseconds+greatest(0,floor(extract(epoch FROM (least(at_time,NEW.playback_until)-NEW.playback_since))*1000))::bigint;
   NEW.playback_since=NULL; NEW.playback_until=NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER match_timing BEFORE UPDATE ON game_matches FOR EACH ROW EXECUTE FUNCTION track_match_timing();
--> statement-breakpoint
CREATE TABLE game_test_archives (
 id uuid PRIMARY KEY, game_id uuid NOT NULL REFERENCES games(id), code text NOT NULL UNIQUE,
 owner_id uuid NOT NULL, rules_version integer NOT NULL, status text NOT NULL, options jsonb NOT NULL,
 participants jsonb NOT NULL, state jsonb NOT NULL, only_bots boolean NOT NULL,
 recorded_at timestamptz NOT NULL, started_at timestamptz, ended_at timestamptz,
 playback_milliseconds bigint NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX test_archive_game_started ON game_test_archives(game_id,recorded_at,id);
--> statement-breakpoint
CREATE TABLE game_test_archive_frames (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid NOT NULL REFERENCES game_test_archives(id),
 version integer NOT NULL, event jsonb NOT NULL, UNIQUE(match_id,version)
);
--> statement-breakpoint
INSERT INTO game_test_archives(id,game_id,code,owner_id,rules_version,status,options,participants,state,only_bots,recorded_at,started_at,ended_at,playback_milliseconds)
 SELECT m.id,m.game_id,m.code,m.owner_id,m.rules_version,m.status,m.options,
 coalesce((select jsonb_agg(jsonb_build_object('seat',p.seat,'userId',p.user_id,'name',p.name) order by p.seat) from game_match_players p where p.match_id=m.id),'[]'::jsonb),
 e.event->'state',m.only_bots,m.created_at,m.started_at,m.ended_at,m.playback_milliseconds
 FROM game_matches m JOIN LATERAL (SELECT event FROM game_match_events WHERE match_id=m.id ORDER BY version DESC LIMIT 1) e ON true
 WHERE m.development AND m.state IS NOT NULL;
--> statement-breakpoint
INSERT INTO game_test_archive_frames(match_id,version,event)
 SELECT e.match_id,e.version,e.event FROM game_match_events e JOIN game_test_archives a ON a.id=e.match_id;
--> statement-breakpoint
CREATE FUNCTION archive_test_match() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest_state jsonb;
BEGIN
 IF NOT NEW.development OR NEW.state IS NULL THEN RETURN NEW; END IF;
 SELECT event->'state' INTO latest_state FROM game_match_events WHERE match_id=NEW.id ORDER BY version DESC LIMIT 1;
 IF latest_state IS NULL THEN RETURN NEW; END IF;
 INSERT INTO game_test_archives(id,game_id,code,owner_id,rules_version,status,options,participants,state,only_bots,recorded_at,started_at,ended_at,playback_milliseconds)
 VALUES(NEW.id,NEW.game_id,NEW.code,NEW.owner_id,NEW.rules_version,NEW.status,NEW.options,
 coalesce((select jsonb_agg(jsonb_build_object('seat',p.seat,'userId',p.user_id,'name',p.name) order by p.seat) from game_match_players p where p.match_id=NEW.id),'[]'::jsonb),
 latest_state,NEW.only_bots,NEW.created_at,NEW.started_at,NEW.ended_at,NEW.playback_milliseconds)
 ON CONFLICT(id) DO UPDATE SET status=excluded.status,state=excluded.state,ended_at=excluded.ended_at,playback_milliseconds=excluded.playback_milliseconds
 WHERE game_test_archives.status='playing';
 INSERT INTO game_test_archive_frames(match_id,version,event)
 SELECT match_id,version,event FROM game_match_events WHERE match_id=NEW.id AND version>coalesce((select max(version) from game_test_archive_frames where match_id=NEW.id),0)
 ON CONFLICT(match_id,version) DO NOTHING;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER archive_test_match_update AFTER UPDATE ON game_matches FOR EACH ROW EXECUTE FUNCTION archive_test_match();
--> statement-breakpoint
CREATE FUNCTION close_deleted_test_archive() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE at_time timestamptz := clock_timestamp();
BEGIN
 UPDATE game_test_archives SET status='abandoned',ended_at=at_time,
 playback_milliseconds=OLD.playback_milliseconds+CASE WHEN OLD.playback_since IS NULL THEN 0 ELSE greatest(0,floor(extract(epoch FROM (least(at_time,OLD.playback_until)-OLD.playback_since))*1000))::bigint END
 WHERE id=OLD.id AND status='playing';
 RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER preserve_deleted_test_archive BEFORE DELETE ON game_matches FOR EACH ROW EXECUTE FUNCTION close_deleted_test_archive();
