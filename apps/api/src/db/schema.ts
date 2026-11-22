import { pgTable, bigint, bigserial, integer, boolean, jsonb, text, check, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const tableVisualSettings = pgTable("table_visual_settings", {
  id: integer("id").primaryKey(), data: jsonb("data").notNull(), version: integer("version").notNull().default(1),
}, table => [check("table_visual_singleton", sql`${table.id} = 1`), check("table_visual_version_positive", sql`${table.version} > 0`)]);
export const seoSettings = pgTable("seo_settings", {
  id: integer("id").primaryKey(), data: jsonb("data").notNull(), version: integer("version").notNull().default(1),
}, table => [check("seo_singleton", sql`${table.id} = 1`), check("seo_version_positive", sql`${table.version} > 0`)]);
export const navigationMenus = pgTable("navigation_menus", {
  location: text("location").primaryKey(),
  items: jsonb("items").notNull(),
  version: integer("version").notNull().default(1),
}, table => [check("menu_location_valid", sql`${table.location} in ('main','footer')`), check("menu_version_positive", sql`${table.version} > 0`)]);
export const pages = pgTable("pages", {
  seo: jsonb("seo").notNull().default(sql`'{}'::jsonb`),
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  document: jsonb("document").notNull(),
  published: boolean("published").notNull().default(false),
  showInMenu: boolean("show_in_menu").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  lastEditedBy: text("last_edited_by"),
  status: text("status").notNull().default("draft"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
}, table => [check("page_version_positive", sql`${table.version} > 0`), check("page_status_valid", sql`${table.status} in ('draft','pending','private','scheduled','published','trash')`), check("page_schedule_date", sql`${table.status} <> 'scheduled' or ${table.publishAt} is not null`)]);
// Referência operacional: não contém valores da economia nem usuários demo.
export const applicationEnvironment = pgTable("application_environment", {
  id: integer("id").primaryKey(),
  environment: text("environment").notNull(),
}, table => [check("single_environment", sql`${table.id} = 1`), check("valid_environment", sql`${table.environment} in ('development', 'test', 'production')`)]);


export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  avatarKey: text("avatar_key"),
  deletionScheduledAt: timestamp("deletion_scheduled_at", { withTimezone: true }),
  usernameChangedAt: timestamp("username_changed_at", { withTimezone: true }),
  displayName: text("display_name").notNull(),
  profileNameProvided: boolean("profile_name_provided").notNull().default(false),
  onboardingRemindAt: timestamp("onboarding_remind_at", { withTimezone: true }),
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


export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  limit: bigint("redemption_limit", { mode: "bigint" }),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  paused: boolean("paused").notNull().default(false),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("coupon_code", sql`${table.code} ~ '^[A-Z0-9_-]{3,32}$'`),
  check("coupon_amount", sql`${table.amount} between 1 and 9007199254740991`),
  check("coupon_limit", sql`${table.limit} is null or ${table.limit} between 1 and 9007199254740991`),
  check("coupon_dates", sql`${table.startsAt} is null or ${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`)]);
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id),
  codeSnapshot: text("code_snapshot").notNull(),
  accountId: uuid("account_id").notNull().references(() => walletAccounts.id),
  requestId: uuid("request_id").notNull(),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  operationId: uuid("operation_id").notNull().unique().references(() => walletOperations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("coupon_account_once").on(table.couponId, table.accountId),
  uniqueIndex("coupon_request_once").on(table.accountId, table.requestId),
  index("coupon_redemption_history").on(table.couponId, table.createdAt),
  check("redemption_amount", sql`${table.amount} between 1 and 9007199254740991`)]);
export const adminAudit = pgTable("admin_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull(),
  targetId: uuid("target_id").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  details: jsonb("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("admin_audit_target").on(table.targetId, table.createdAt)]);

export const games = pgTable("games", {
  description: text("description").notNull().default(""),
  seo: jsonb("seo").notNull().default(sql`'{}'::jsonb`),
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  imageUrl: text("image_url"),
  version: integer("version").notNull().default(1),
}, table => [check("game_version_positive", sql`${table.version} > 0`), check("game_slug_valid", sql`length(${table.slug}) between 1 and 100 and ${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)]);

// Catálogo administrativo; palpites e liquidações serão integrados antes da abertura pública.
export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  criterion: text("criterion").notNull(),
  type: text("type").notNull(),
  options: jsonb("options").notNull(),
  unit: text("unit").notNull(),
  status: text("status").notNull().default("draft"),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
}, table => [check("market_version_positive", sql`${table.version} > 0`), check("market_type_valid", sql`${table.type} in ('binary','choice','number')`), check("market_status_valid", sql`${table.status} in ('draft','open','paused','closed')`)]);

// Shared match lifecycle; each game validates its private state through its driver.
export const gameMatches = pgTable("game_matches", {
  id: uuid("id").primaryKey().defaultRandom(), code: text("code").notNull().unique(),
  gameId: uuid("game_id").notNull().references(() => games.id), gameSlug: text("game_slug").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  development: boolean("development").notNull().default(false), bots: integer("bots").notNull().default(0), onlyBots: boolean("only_bots").notNull().default(false),
  entryAmount: bigint("entry_amount", { mode: "bigint" }).notNull().default(sql`0`),
  capacity: integer("capacity").notNull(), options: jsonb("options").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rulesVersion: integer("rules_version").notNull(), version: integer("version").notNull(), status: text("status").notNull(), state: jsonb("state"),
  startedAt: timestamp("started_at", { withTimezone: true }), endedAt: timestamp("ended_at", { withTimezone: true }),
  playbackSince: timestamp("playback_since", { withTimezone: true }), playbackUntil: timestamp("playback_until", { withTimezone: true }),
  playbackMilliseconds: bigint("playback_milliseconds", { mode: "number" }).notNull().default(0),
  lobbyExpiresAt: timestamp("lobby_expires_at", { withTimezone: true }).notNull().default(sql`now() + interval '32 minutes'`),
  lobbyOfflineSince: timestamp("lobby_offline_since", { withTimezone: true }),
  lobbyClosedReason: text("lobby_closed_reason"),
  creationRequestId: uuid("creation_request_id").notNull(), creationHash: text("creation_hash").notNull(), creationResponse: jsonb("creation_response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("match_playback_nonnegative",sql`${table.playbackMilliseconds} >= 0`),check("test_economy",sql`NOT ${table.development} OR ${table.entryAmount}=0`),check("test_bots",sql`${table.bots} BETWEEN 0 AND 12 AND (${table.development} OR (${table.bots}=0 AND NOT ${table.onlyBots}))`),check("match_entry_range", sql`${table.entryAmount} between 0 and 9007199254740991`), uniqueIndex("match_creation_request").on(table.createdBy, table.creationRequestId), index("match_owner_status").on(table.ownerId,table.status), check("match_status", sql`${table.status} in ('lobby','playing','finished','abandoned')`), check("match_capacity", sql`${table.capacity} between 2 and 12`), check("match_versions", sql`${table.version}>0 and ${table.rulesVersion}>0`)]);
export const gameMatchPlayers = pgTable("game_match_players", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(() => gameMatches.id, { onDelete: "cascade" }),
  confirmedEntryAmount: bigint("confirmed_entry_amount", { mode: "bigint" }),
  lobbyOfflineSince: timestamp("lobby_offline_since", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  seat: integer("seat").notNull(), userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), controllerId: uuid("controller_id").references(() => users.id, { onDelete: "set null" }), name: text("name").notNull(), kind: text("kind").notNull(),
}, table => [check("match_confirmation_range", sql`${table.confirmedEntryAmount} is null or ${table.confirmedEntryAmount} between 1 and 9007199254740991`), uniqueIndex("match_seat").on(table.matchId,table.seat), uniqueIndex("match_member").on(table.matchId,table.userId), check("match_seat_valid", sql`${table.seat}>=0`),check("match_player_kind",sql`${table.kind} in ('user','guest','bot')`)]);
export const gameMatchCommands = pgTable("game_match_commands", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(() => gameMatches.id, { onDelete: "cascade" }), actorId: uuid("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }), commandId: uuid("command_id").notNull(), payloadHash: text("payload_hash").notNull(), response: jsonb("response").notNull(),
}, table => [uniqueIndex("match_command_once").on(table.matchId,table.actorId,table.commandId)]);
export const gameMatchEvents = pgTable("game_match_events", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(() => gameMatches.id, { onDelete: "cascade" }), version: integer("version").notNull(), event: jsonb("event").notNull(),
}, table => [uniqueIndex("match_event_version").on(table.matchId,table.version)]);

export const userPresence = pgTable("user_presence", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const gameMatchInvitations = pgTable("game_match_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => gameMatches.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [uniqueIndex("match_invitation_recipient").on(table.matchId, table.recipientId), index("match_invitations_inbox").on(table.recipientId), check("match_invitation_other_user", sql`${table.senderId} <> ${table.recipientId}`)]);

export const matchPresence = pgTable("match_presence", {
  id: uuid("id").primaryKey(),
  matchId: uuid("match_id").notNull().references(() => gameMatches.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [index("match_presence_room").on(table.matchId)]);

// Independent audit records survive account and operational-room deletion.
export const gameMatchArchives = pgTable("game_match_archives", {
  id: uuid("id").primaryKey(), gameId: uuid("game_id").notNull().references(() => games.id), code: text("code").notNull(),
  rulesVersion: integer("rules_version").notNull(), status: text("status").notNull(), options: jsonb("options").notNull(),
  participants: jsonb("participants").notNull(), state: jsonb("state").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(), endedAt: timestamp("ended_at", { withTimezone: true }),
}, table => [index("archive_game_started").on(table.gameId, table.startedAt, table.id)]);
export const gameMatchArchiveFrames = pgTable("game_match_archive_frames", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(() => gameMatchArchives.id),
  version: integer("version").notNull(), event: jsonb("event").notNull(),
}, table => [uniqueIndex("archive_frame_version").on(table.matchId, table.version)]);

// Test records remain separate from official statistics and survive account deletion.
export const gameTestArchives = pgTable("game_test_archives", {
  id: uuid("id").primaryKey(), gameId: uuid("game_id").notNull().references(() => games.id), code: text("code").notNull().unique(),
  ownerId: uuid("owner_id").notNull(), rulesVersion: integer("rules_version").notNull(), status: text("status").notNull(), options: jsonb("options").notNull(),
  participants: jsonb("participants").notNull(), state: jsonb("state").notNull(), onlyBots: boolean("only_bots").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(), startedAt: timestamp("started_at", { withTimezone: true }), endedAt: timestamp("ended_at", { withTimezone: true }),
  playbackMilliseconds: bigint("playback_milliseconds", { mode: "number" }).notNull().default(0),
}, table => [index("test_archive_game_started").on(table.gameId, table.recordedAt, table.id)]);
export const gameTestArchiveFrames = pgTable("game_test_archive_frames", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(() => gameTestArchives.id),
  version: integer("version").notNull(), event: jsonb("event").notNull(),
}, table => [uniqueIndex("game_test_archive_frames_match_id_version_key").on(table.matchId, table.version)]);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey(), name: text("name").notNull(),
  width: integer("width").notNull(), height: integer("height").notNull(), bytes: integer("bytes").notNull(),
  state: text("state").notNull().default("uploading"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("media_state", sql`${table.state} in ('uploading','ready','deleted')`),
  check("media_dimensions", sql`${table.width}>0 and ${table.height}>0 and ${table.bytes}>0`),
  index("media_listing").on(table.state, table.createdAt, table.id)]);

// Independent of operational rooms/users so settlement audit survives deletion.
export const gameMatchStakes = pgTable("game_match_stakes", {
  matchId: uuid("match_id").primaryKey(),
  potAccountId: uuid("pot_account_id").notNull().unique().references(() => walletAccounts.id),
  entryAmount: bigint("entry_amount", { mode: "bigint" }).notNull(),
  potTotal: bigint("pot_total", { mode: "bigint" }).notNull(),
  contributions: jsonb("contributions").notNull(),
  payouts: jsonb("payouts").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, table => [check("match_stake_status", sql`${table.status} in ('pending','paid','refunded')`),
  check("match_stake_amounts", sql`${table.entryAmount}>0 and ${table.potTotal}>=${table.entryAmount} and ${table.potTotal}<=9007199254740991`)]);

export const achievementDefinitions = pgTable("achievement_definitions", {
  imageUrl: text("image_url").notNull().default(""),
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), icon: text("icon").notNull(),
  metric: text("metric").notNull(), active: boolean("active").notNull().default(true),
  order: integer("sort_order").notNull().default(0), version: integer("version").notNull().default(1),
}, table => [check("achievement_metric_valid", sql`${table.metric} in ('games','wins','dailyDays','dailyStreak','coupons','losingGames')`),
  check("achievement_definition_valid", sql`char_length(${table.name}) between 1 and 80 and ${table.order} >= 0 and ${table.version} > 0`)]);
export const achievementLevels = pgTable("achievement_levels", {
  id: uuid("id").primaryKey().defaultRandom(), achievementId: uuid("achievement_id").notNull().references(() => achievementDefinitions.id),
  target: bigint("target", { mode: "number" }).notNull(), description: text("description").notNull(),
}, table => [uniqueIndex("achievement_level_target_unique").on(table.achievementId, table.target),
  check("achievement_level_valid", sql`${table.target} between 1 and 9007199254740991 and char_length(${table.description}) between 1 and 240`)]);
export const achievementUnlocks = pgTable("achievement_unlocks", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  levelId: uuid("level_id").notNull().references(() => achievementLevels.id),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("achievement_unlock_once").on(table.userId, table.levelId), index("achievement_unlock_level_idx").on(table.levelId)]);

// Independent cancellation audit survives deletion of operational rooms/accounts.
export const gameMatchCancellations=pgTable("game_match_cancellations",{
 id:uuid("id").primaryKey().defaultRandom(),matchId:uuid("match_id").notNull(),code:text("code").notNull(),
 proposedBy:uuid("proposed_by").notNull(),eligibleUserIds:jsonb("eligible_user_ids").notNull(),acceptedUserIds:jsonb("accepted_user_ids").notNull(),
 status:text("status").notNull().default("pending"),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),resolvedAt:timestamp("resolved_at",{withTimezone:true}),
},t=>[uniqueIndex("one_pending_match_cancellation").on(t.matchId).where(sql`${t.status}='pending'`),index("match_cancellation_history").on(t.matchId,t.createdAt),check("match_cancellation_status",sql`${t.status} in ('pending','accepted','rejected','closed')`)]);

// Chat messages retain moderation evidence after account deletion.
export const chatMessages = pgTable("chat_messages", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  requestId: uuid("request_id").notNull().unique(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
}, table => [index("chat_messages_user_created_idx").on(table.userId,table.createdAt), check("chat_text_length", sql`char_length(${table.text}) between 1 and 500`)]);
export const chatMutes = pgTable("chat_mutes", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  until: timestamp("until", { withTimezone: true }).notNull(),
});
export const chatEvents = pgTable("chat_events", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  kind: text("kind").notNull(),
  messageId: bigint("message_id", { mode: "bigint" }).references(() => chatMessages.id),
  subjectId: uuid("subject_id"),
  actorId: uuid("actor_id"),
  mutedUntil: timestamp("muted_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("chat_event_kind", sql`${table.kind} in ('message','delete','mute')`)]);
