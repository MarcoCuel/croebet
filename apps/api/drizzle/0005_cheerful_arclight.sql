CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "wallet_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wallet_account_kind" CHECK ("wallet_accounts"."kind" in ('user','issuance','house','pot')),
	CONSTRAINT "wallet_balance_range" CHECK ("wallet_accounts"."balance" between -9007199254740991 and 9007199254740991 and ("wallet_accounts"."kind" = 'issuance' or "wallet_accounts"."balance" >= 0)),
	CONSTRAINT "wallet_user_kind" CHECK ("wallet_accounts"."user_id" is null or "wallet_accounts"."kind" = 'user')
);
--> statement-breakpoint
CREATE TABLE "wallet_entries" (
	"sequence" bigserial NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"balance" bigint NOT NULL,
	CONSTRAINT "wallet_entries_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "wallet_entry_amount" CHECK ("wallet_entries"."amount" != 0 and "wallet_entries"."amount" between -9007199254740991 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "wallet_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_operation_id_wallet_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."wallet_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_account_id_wallet_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_operations" ADD CONSTRAINT "wallet_operations_actor_account_id_wallet_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_entry_account_operation" ON "wallet_entries" USING btree ("operation_id","account_id");--> statement-breakpoint
CREATE INDEX "wallet_entries_account" ON "wallet_entries" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_operation_idempotency" ON "wallet_operations" USING btree ("scope","idempotency_key");--> statement-breakpoint
-- Wallet initialization does not grant any Croins. Values remain a product decision.
INSERT INTO wallet_accounts (user_id, kind) SELECT id, 'user' FROM users;
--> statement-breakpoint
CREATE FUNCTION wallet_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Wallet history is immutable'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER wallet_operations_immutable BEFORE UPDATE OR DELETE ON wallet_operations FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
--> statement-breakpoint
CREATE TRIGGER wallet_entries_immutable BEFORE UPDATE OR DELETE ON wallet_entries FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
--> statement-breakpoint
CREATE FUNCTION wallet_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.balance <> 0 THEN RAISE EXCEPTION 'Initial balance must be zero'; END IF;
  ELSE
    IF NEW.id <> OLD.id OR NEW.kind <> OLD.kind OR
       (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Account identity is immutable';
    END IF;
    IF NEW.balance <> OLD.balance AND pg_trigger_depth() < 2 THEN
      RAISE EXCEPTION 'Balances require ledger entries';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER wallet_account_guard BEFORE INSERT OR UPDATE ON wallet_accounts FOR EACH ROW EXECUTE FUNCTION wallet_account_guard();
--> statement-breakpoint
CREATE FUNCTION wallet_apply_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_balance bigint;
BEGIN
  -- Entries cannot be appended to a previously committed operation.
  IF NOT EXISTS (SELECT 1 FROM wallet_operations WHERE id=NEW.operation_id AND xmin::text=pg_current_xact_id()::text) THEN
    RAISE EXCEPTION 'Operation already committed';
  END IF;
  UPDATE wallet_accounts SET balance=balance + NEW.amount WHERE id=NEW.account_id RETURNING balance INTO next_balance;
  IF next_balance IS NULL OR next_balance <> NEW.balance THEN RAISE EXCEPTION 'Invalid resulting balance'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER wallet_apply_entry BEFORE INSERT ON wallet_entries FOR EACH ROW EXECUTE FUNCTION wallet_apply_entry();
--> statement-breakpoint
CREATE FUNCTION wallet_conservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM wallet_entries WHERE operation_id=NEW.id) < 2 OR
     (SELECT coalesce(sum(amount),0) FROM wallet_entries WHERE operation_id=NEW.id) <> 0 THEN
    RAISE EXCEPTION 'Unbalanced wallet operation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER wallet_conservation AFTER INSERT ON wallet_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION wallet_conservation();
