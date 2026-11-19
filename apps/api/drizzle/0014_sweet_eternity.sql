CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"criterion" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb NOT NULL,
	"unit" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"ends_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "market_version_positive" CHECK ("markets"."version" > 0),
	CONSTRAINT "market_type_valid" CHECK ("markets"."type" in ('binary','choice','number')),
	CONSTRAINT "market_status_valid" CHECK ("markets"."status" in ('draft','open','paused','closed'))
);
