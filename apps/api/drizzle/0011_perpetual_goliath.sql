ALTER TABLE "pages" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "page_status_valid" CHECK ("pages"."status" in ('draft','pending','private','scheduled','published'));--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "page_schedule_date" CHECK ("pages"."status" <> 'scheduled' or "pages"."publish_at" is not null);
--> statement-breakpoint
UPDATE pages SET status=CASE WHEN published THEN 'published' ELSE 'draft' END, publish_at=published_at;
