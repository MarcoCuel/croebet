CREATE TABLE "admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"code_snapshot" text NOT NULL,
	"account_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"operation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_operation_id_unique" UNIQUE("operation_id"),
	CONSTRAINT "redemption_amount" CHECK ("coupon_redemptions"."amount" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"amount" bigint NOT NULL,
	"redemption_limit" bigint,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"paused" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupon_code" CHECK ("coupons"."code" ~ '^[A-Z0-9_-]{3,32}$'),
	CONSTRAINT "coupon_amount" CHECK ("coupons"."amount" between 1 and 9007199254740991),
	CONSTRAINT "coupon_limit" CHECK ("coupons"."redemption_limit" is null or "coupons"."redemption_limit" between 1 and 9007199254740991),
	CONSTRAINT "coupon_dates" CHECK ("coupons"."starts_at" is null or "coupons"."ends_at" is null or "coupons"."ends_at" > "coupons"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_account_id_wallet_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_operation_id_wallet_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."wallet_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_target" ON "admin_audit" USING btree ("target_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_account_once" ON "coupon_redemptions" USING btree ("coupon_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_request_once" ON "coupon_redemptions" USING btree ("account_id","request_id");--> statement-breakpoint
CREATE INDEX "coupon_redemption_history" ON "coupon_redemptions" USING btree ("coupon_id","created_at");--> statement-breakpoint
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON admin_audit FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
--> statement-breakpoint
CREATE TRIGGER coupon_redemptions_immutable BEFORE UPDATE OR DELETE ON coupon_redemptions FOR EACH ROW EXECUTE FUNCTION wallet_immutable();
