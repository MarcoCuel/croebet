import { pgTable, integer, text, check, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// Referência operacional: não contém valores da economia nem usuários demo.
export const applicationEnvironment = pgTable("application_environment", {
  id: integer("id").primaryKey(),
  environment: text("environment").notNull(),
}, table => [check("single_environment", sql`${table.id} = 1`), check("valid_environment", sql`${table.environment} in ('development', 'test', 'production')`)]);


export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  usernameChangedAt: timestamp("username_changed_at", { withTimezone: true }),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("users_username_case_insensitive_unique").on(sql`lower(${table.username})`), check("users_username_check", sql`${table.username} ~ '^[A-Za-z0-9._]{3,24}$'`), check("users_display_name_check", sql`char_length(${table.displayName}) BETWEEN 1 AND 40`), check("users_role_check", sql`${table.role} IN ('user','admin')`), check("users_status_check", sql`${table.status} IN ('active','suspended')`)]);
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("sessions_token_hash_check", sql`length(${table.tokenHash}) = 64`), index("sessions_user_id_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);
export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull(),
}, table => [check("auth_rate_limits_attempts_check", sql`${table.attempts} > 0`)]);
