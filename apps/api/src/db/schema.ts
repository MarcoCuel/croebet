import { pgTable, bigint, bigserial, integer, text, check, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// Referência operacional: não contém valores da economia nem usuários demo.
export const applicationEnvironment = pgTable("application_environment", {
  id: integer("id").primaryKey(),
  environment: text("environment").notNull(),
}, table => [check("single_environment", sql`${table.id} = 1`), check("valid_environment", sql`${table.environment} in ('development', 'test', 'production')`)]);


export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  avatarKey: text("avatar_key"),
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

export const avatarCleanup = pgTable("avatar_cleanup", {
  key: text("key").primaryKey(),
  deleteAfter: timestamp("delete_after", { withTimezone: true }).notNull().defaultNow(),
});

// A deleted user leaves an unlinked account so immutable economic history survives.
export const walletAccounts = pgTable("wallet_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").unique().references(() => users.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  balance: bigint("balance", { mode: "bigint" }).notNull().default(sql`0`),
}, table => [check("wallet_account_kind", sql`${table.kind} in ('user','issuance','house','pot')`),
  check("wallet_balance_range", sql`${table.balance} between -9007199254740991 and 9007199254740991 and (${table.kind} = 'issuance' or ${table.balance} >= 0)`),
  check("wallet_user_kind", sql`${table.userId} is null or ${table.kind} = 'user'`)]);
export const walletOperations = pgTable("wallet_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  payloadHash: text("payload_hash").notNull(),
  actorAccountId: uuid("actor_account_id").notNull().references(() => walletAccounts.id),
  reason: text("reason").notNull(),
  reference: text("reference").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("wallet_operation_idempotency").on(table.scope, table.idempotencyKey)]);
export const walletEntries = pgTable("wallet_entries", {
  sequence: bigserial("sequence", { mode: "bigint" }).notNull().unique(),
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => walletOperations.id),
  accountId: uuid("account_id").notNull().references(() => walletAccounts.id),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  balance: bigint("balance", { mode: "bigint" }).notNull(),
}, table => [uniqueIndex("wallet_entry_account_operation").on(table.operationId, table.accountId),
  index("wallet_entries_account").on(table.accountId),
  check("wallet_entry_amount", sql`${table.amount} != 0 and ${table.amount} between -9007199254740991 and 9007199254740991`)]);

export const dailyClaims = pgTable("daily_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => walletAccounts.id),
  requestId: uuid("request_id").notNull(),
  operationId: uuid("operation_id").notNull().unique().references(() => walletOperations.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("daily_claim_request").on(table.accountId, table.requestId),
  index("daily_claim_account_time").on(table.accountId, table.claimedAt)]);
