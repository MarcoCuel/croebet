CREATE TABLE "daily_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_claims_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
ALTER TABLE "daily_claims" ADD CONSTRAINT "daily_claims_account_id_wallet_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_claims" ADD CONSTRAINT "daily_claims_operation_id_wallet_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."wallet_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_claim_request" ON "daily_claims" USING btree ("account_id","request_id");--> statement-breakpoint
CREATE INDEX "daily_claim_account_time" ON "daily_claims" USING btree ("account_id","claimed_at");--> statement-breakpoint
-- Technical issuance account only. All grants go through balanced ledger entries.
INSERT INTO wallet_accounts (id, kind) VALUES ('00000000-0000-4000-8000-000000000001', 'issuance');
--> statement-breakpoint
CREATE TRIGGER daily_claims_immutable BEFORE UPDATE OR DELETE ON daily_claims FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
