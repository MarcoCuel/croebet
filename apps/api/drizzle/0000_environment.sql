CREATE TABLE "application_environment" (
  "id" integer PRIMARY KEY NOT NULL,
  "environment" text NOT NULL,
  CONSTRAINT "single_environment" CHECK ("application_environment"."id" = 1),
  CONSTRAINT "valid_environment" CHECK ("application_environment"."environment" in ('development', 'test', 'production'))
);
