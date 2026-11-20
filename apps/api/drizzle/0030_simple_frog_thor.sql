CREATE TABLE "game_match_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"code" text NOT NULL,
	"proposed_by" uuid NOT NULL,
	"eligible_user_ids" jsonb NOT NULL,
	"accepted_user_ids" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "match_cancellation_status" CHECK ("game_match_cancellations"."status" in ('pending','accepted','rejected','closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_match_cancellation" ON "game_match_cancellations" USING btree ("match_id") WHERE "game_match_cancellations"."status"='pending';--> statement-breakpoint
CREATE INDEX "match_cancellation_history" ON "game_match_cancellations" USING btree ("match_id","created_at");
--> statement-breakpoint
-- A vote is invalidated if a controller leaves or if the match finishes first.
CREATE FUNCTION close_match_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='game_matches' THEN
  IF TG_OP='DELETE' THEN
   UPDATE game_match_cancellations SET status='closed',resolved_at=clock_timestamp() WHERE match_id=OLD.id AND status='pending';
  ELSIF NEW.status<>'playing' THEN
   UPDATE game_match_cancellations SET status='closed',resolved_at=clock_timestamp() WHERE match_id=NEW.id AND status='pending';
  END IF;
 ELSE
  IF TG_OP='DELETE' THEN
   UPDATE game_match_cancellations SET status='closed',resolved_at=clock_timestamp() WHERE match_id=OLD.match_id AND status='pending';
  ELSIF NEW.controller_id IS DISTINCT FROM OLD.controller_id THEN
   UPDATE game_match_cancellations SET status='closed',resolved_at=clock_timestamp() WHERE match_id=NEW.match_id AND status='pending';
  END IF;
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER close_cancellation_on_match AFTER UPDATE OF status OR DELETE ON game_matches FOR EACH ROW EXECUTE FUNCTION close_match_cancellation();
--> statement-breakpoint
CREATE TRIGGER close_cancellation_on_controller AFTER UPDATE OF controller_id OR DELETE ON game_match_players FOR EACH ROW EXECUTE FUNCTION close_match_cancellation();
--> statement-breakpoint
CREATE FUNCTION preserve_cancellation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancellation audit cannot be deleted'; END IF;
 IF OLD.status<>'pending' OR NEW.match_id<>OLD.match_id OR NEW.code<>OLD.code OR NEW.proposed_by<>OLD.proposed_by OR NEW.eligible_user_ids<>OLD.eligible_user_ids THEN
  RAISE EXCEPTION 'Cancellation audit is immutable after resolution';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_cancellation_audit BEFORE UPDATE OR DELETE ON game_match_cancellations FOR EACH ROW EXECUTE FUNCTION preserve_cancellation_audit();
