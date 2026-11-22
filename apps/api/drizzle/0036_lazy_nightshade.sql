CREATE TABLE "table_visual_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "table_visual_singleton" CHECK ("table_visual_settings"."id" = 1),
	CONSTRAINT "table_visual_version_positive" CHECK ("table_visual_settings"."version" > 0)
);
