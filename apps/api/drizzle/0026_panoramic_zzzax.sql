CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"state" text DEFAULT 'uploading' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_state" CHECK ("media_assets"."state" in ('uploading','ready','deleted')),
	CONSTRAINT "media_dimensions" CHECK ("media_assets"."width">0 and "media_assets"."height">0 and "media_assets"."bytes">0)
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_listing" ON "media_assets" USING btree ("state","created_at","id");