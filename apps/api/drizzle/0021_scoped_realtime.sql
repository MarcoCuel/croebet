-- Wake-up signals identify the affected data; all state is still read after commit.
DROP TRIGGER matches_realtime ON game_matches;
DROP TRIGGER invitations_realtime ON game_match_invitations;
DROP TRIGGER presence_realtime ON match_presence;
DROP TRIGGER sessions_realtime ON sessions;
DROP TRIGGER users_realtime ON users;
DROP TRIGGER games_realtime ON games;
DROP FUNCTION notify_match_realtime();
--> statement-breakpoint
CREATE FUNCTION notify_match_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  n jsonb := coalesce(to_jsonb(NEW), to_jsonb(OLD));
  o jsonb := to_jsonb(OLD);
  room_code text;
  room_status text;
  directory_changed boolean;
  matches_changed boolean;
  recipient uuid;
BEGIN
  IF TG_TABLE_NAME = 'game_matches' THEN
    directory_changed := TG_OP <> 'UPDATE' OR n->>'status' = 'lobby' OR o->>'status' = 'lobby'
      OR n->>'status' IS DISTINCT FROM o->>'status' OR n->>'owner_id' IS DISTINCT FROM o->>'owner_id';
    matches_changed := TG_OP <> 'UPDATE' OR n->>'status' IS DISTINCT FROM o->>'status'
      OR n->>'owner_id' IS DISTINCT FROM o->>'owner_id'
      OR n->'state'->'round' IS DISTINCT FROM o->'state'->'round';
    PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','room','code',n->>'code','directory',directory_changed,'matches',matches_changed)::text);
    IF directory_changed THEN
      FOR recipient IN SELECT user_id FROM game_match_players WHERE match_id=(n->>'id')::uuid AND user_id IS NOT NULL LOOP
        PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','account','userId',recipient)::text);
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME IN ('game_match_invitations', 'match_presence', 'game_match_players') THEN
    SELECT code, status INTO room_code, room_status FROM game_matches WHERE id=(n->>'match_id')::uuid;
    IF TG_TABLE_NAME = 'game_match_invitations' THEN
      PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','invitation','userId',n->>'recipient_id','code',coalesce(room_code,''))::text);
    ELSIF TG_TABLE_NAME = 'match_presence' THEN
      -- Presence is only displayed in open lobbies.
      IF room_status = 'lobby' THEN
        PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','presence','code',room_code)::text);
      END IF;
    ELSE
      IF TG_OP <> 'UPDATE' OR n->'controller_id' IS DISTINCT FROM o->'controller_id' OR n->'user_id' IS DISTINCT FROM o->'user_id' THEN
        FOR recipient IN SELECT DISTINCT value::uuid FROM (VALUES (n->>'user_id'), (o->>'user_id')) ids(value) WHERE value IS NOT NULL LOOP
          PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','account','userId',recipient)::text);
        END LOOP;
        IF room_code IS NOT NULL THEN
          PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','room','code',room_code,'directory',room_status='lobby','matches',room_status='playing')::text);
        END IF;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN ('sessions','users') THEN
    PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','auth','userId',CASE WHEN TG_TABLE_NAME='sessions' THEN n->>'user_id' ELSE n->>'id' END)::text);
    IF TG_TABLE_NAME='users' THEN
      FOR recipient, room_code IN SELECT i.recipient_id, m.code FROM game_match_invitations i JOIN game_matches m ON m.id=i.match_id WHERE i.sender_id=(n->>'id')::uuid LOOP
        PERFORM pg_notify('croebet_matches', jsonb_build_object('kind','invitation','userId',recipient,'code',room_code)::text);
      END LOOP;
    END IF;
  ELSE
    PERFORM pg_notify('croebet_matches', '{"kind":"catalog"}');
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER matches_realtime AFTER INSERT OR UPDATE OR DELETE ON game_matches FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
CREATE TRIGGER invitations_realtime AFTER INSERT OR UPDATE OR DELETE ON game_match_invitations FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
CREATE TRIGGER presence_realtime AFTER INSERT OR DELETE ON match_presence FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
CREATE TRIGGER participants_realtime AFTER INSERT OR UPDATE OR DELETE ON game_match_players FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
CREATE TRIGGER sessions_realtime AFTER DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
CREATE TRIGGER users_realtime AFTER DELETE OR UPDATE OF status, role ON users FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
CREATE TRIGGER games_realtime AFTER UPDATE OF enabled ON games FOR EACH ROW EXECUTE FUNCTION notify_match_realtime();
