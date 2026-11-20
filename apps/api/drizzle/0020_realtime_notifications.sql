-- Notifications are delivered only after commit. Persisted events remain the
-- source of truth, including after listener reconnection or an API restart.
CREATE FUNCTION notify_match_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('croebet_matches', 'changed');
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER matches_realtime AFTER INSERT OR UPDATE OR DELETE ON game_matches
FOR EACH STATEMENT EXECUTE FUNCTION notify_match_realtime();
--> statement-breakpoint
CREATE TRIGGER invitations_realtime AFTER INSERT OR UPDATE OR DELETE ON game_match_invitations
FOR EACH STATEMENT EXECUTE FUNCTION notify_match_realtime();
--> statement-breakpoint
CREATE TRIGGER presence_realtime AFTER INSERT OR DELETE ON match_presence
FOR EACH STATEMENT EXECUTE FUNCTION notify_match_realtime();
--> statement-breakpoint
CREATE TRIGGER sessions_realtime AFTER DELETE ON sessions
FOR EACH STATEMENT EXECUTE FUNCTION notify_match_realtime();
--> statement-breakpoint
CREATE TRIGGER users_realtime AFTER DELETE OR UPDATE OF status, role ON users
FOR EACH STATEMENT EXECUTE FUNCTION notify_match_realtime();
--> statement-breakpoint
CREATE TRIGGER games_realtime AFTER UPDATE OF enabled ON games
FOR EACH STATEMENT EXECUTE FUNCTION notify_match_realtime();
