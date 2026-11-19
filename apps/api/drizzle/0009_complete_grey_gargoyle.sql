ALTER TABLE "pages" ADD COLUMN "created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "last_edited_by" text;
--> statement-breakpoint
-- Discard only untouched reference pages in disposable environments.
-- Pages created or edited by an administrator have an audit entry and stay intact.
DELETE FROM pages p
WHERE EXISTS (SELECT 1 FROM application_environment WHERE id=1 AND environment IN ('development','test'))
  AND p.version=1
  AND p.slug IN ('sobre','termos','privacidade')
  AND NOT EXISTS (SELECT 1 FROM admin_audit a WHERE a.target_id=p.id AND a.action IN ('page.created','page.updated'));
