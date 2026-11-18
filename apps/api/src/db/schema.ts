import { pgTable, integer, text, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// Referência operacional: não contém valores da economia nem usuários demo.
export const applicationEnvironment = pgTable("application_environment", {
  id: integer("id").primaryKey(),
  environment: text("environment").notNull(),
}, table => [check("single_environment", sql`${table.id} = 1`), check("valid_environment", sql`${table.environment} in ('development', 'test', 'production')`)]);

