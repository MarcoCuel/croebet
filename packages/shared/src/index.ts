import { z } from "zod";
export * from "./matches.js";
export * from "./realtime.js";
export * from "./rich-text.js";
export * from "./pages.js";
export * from "./seo.js";
export * from "./menus.js";
export * from "./icons.js";

export const healthSchema = z.object({ status: z.literal("ok"), service: z.literal("croebet-api") }).strict();
export const readinessSchema = z.object({ status: z.enum(["ready", "unavailable"]) }).strict();
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();
export type Health = z.infer<typeof healthSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;


export const usernameSchema = z.string().trim().min(3, "Use pelo menos 3 caracteres no usuário.").max(24).regex(/^[A-Za-z0-9._]+$/, "Use letras, números, ponto ou sublinhado.");
const passwordSchema = z.string().refine(value => Array.from(value).length >= 8 && Array.from(value).length <= 128, "Use uma senha de 8 a 128 caracteres.");
export const registerSchema = z.object({ username: usernameSchema, password: passwordSchema }).strict();
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(512) }).strict();
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(512) }).strict();
export const changeUsernameSchema = z.object({ username: usernameSchema }).strict();
export const profileSchema = z.object({ displayName: z.string().trim().min(1).max(40).regex(/^[^\u0000-\u001f\u007f]+$/u) }).strict();
export const avatarUrlSchema = z.string().regex(/^\/api\/v1\/avatars\/[0-9a-f-]{36}\.webp$/).nullable().default(null);
export const publicUserSchema = z.object({ id: z.uuid(), username: usernameSchema, displayName: z.string(), avatarUrl: avatarUrlSchema, usernameChangeAvailableAt: z.iso.datetime().nullable().default(null), role: z.enum(["user", "admin"]) }).strict();
export const sessionSchema = z.object({ user: publicUserSchema.nullable() }).strict();
export type PublicUser = z.infer<typeof publicUserSchema>;
export const publicProfileSchema = z.object({ username: usernameSchema, displayName: z.string(), avatarUrl: avatarUrlSchema }).strict();
export type PublicProfile = z.infer<typeof publicProfileSchema>;

export const croinsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const walletSchema = z.object({ balance: croinsSchema }).strict();
export const transactionSchema = z.object({
  id: z.uuid(), createdAt: z.iso.datetime(), description: z.string(),
  amount: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).refine(value => value !== 0),
  balance: croinsSchema, reference: z.string().optional(),
}).strict();
export const transactionsQuerySchema = z.object({
  direction: z.enum(["all", "income", "expense"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
}).strict();
export const transactionsSchema = z.object({ items: z.array(transactionSchema), hasMore: z.boolean() }).strict();

// Shapes only: economic values are owned and served by Fastify.
export const economySchema = z.object({
  initialBalance: croinsSchema,
  dailyReward: croinsSchema,
  dailyResetTimeZone: z.literal("America/Sao_Paulo"),
  suggestedBets: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1),
  defaultBet: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict().refine(value => value.suggestedBets.includes(value.defaultBet));
export type Economy = z.infer<typeof economySchema>;
export const dailyStatusSchema = z.object({
  balance: croinsSchema,
  lastClaimAt: z.iso.datetime().nullable(),
  nextClaimAt: z.iso.datetime().nullable(),
  eligible: z.boolean(),
  serverNow: z.iso.datetime(),
}).strict();
export type DailyStatus = z.infer<typeof dailyStatusSchema>;
export const dailyClaimSchema = z.object({ requestId: z.uuid() }).strict();
// Coupon amounts are chosen per coupon, never drawn from a preset reward.
export const couponAmountSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const roleSchema = z.enum(["user", "admin"]);
export const userStatusSchema = z.enum(["active", "suspended"]);
export const reasonSchema = z.string().trim().max(256).regex(/^[^\u0000-\u001f\u007f]*$/u).default("");
export const adminQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  status: z.enum(["all", "active", "suspended"]).default("all"),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const userChangeSchema = z.object({ role: roleSchema, status: userStatusSchema, expectedRole: roleSchema, expectedStatus: userStatusSchema, reason: reasonSchema }).strict();
export const balanceAdjustmentSchema = z.object({ requestId: z.uuid(), direction: z.enum(["add", "remove"]), amount: couponAmountSchema, reason: reasonSchema }).strict();
export const adminUserSchema = z.object({
  id: z.uuid(), username: usernameSchema, displayName: z.string(), avatarUrl: avatarUrlSchema,
  role: roleSchema, status: userStatusSchema, balance: croinsSchema, createdAt: z.iso.datetime(),
}).strict();
export type AdminUser = z.infer<typeof adminUserSchema>;
export const adminUserCountsSchema = z.object({ all: z.number().int().nonnegative(), active: z.number().int().nonnegative(), suspended: z.number().int().nonnegative() }).strict();
export const adminUsersSchema = z.object({ items: z.array(adminUserSchema), hasMore: z.boolean(), total: z.number().int().nonnegative(), counts: adminUserCountsSchema }).strict();
export const auditSchema = z.object({ id: z.uuid(), actorId: z.uuid(), actorUsername: z.string().nullable(), action: z.string(), reason: z.string(), createdAt: z.iso.datetime(), details: z.record(z.string(), z.unknown()) }).strict();
export const auditPageSchema = z.object({ items: z.array(auditSchema), hasMore: z.boolean() }).strict();
export const adminUserDetailSchema = z.object({ user: adminUserSchema, transactions: transactionsSchema, audit: auditPageSchema }).strict();
export const couponCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "Use de 3 a 32 letras, números, hífen ou sublinhado.");
export const couponWriteSchema = z.object({
  code: couponCodeSchema, amount: couponAmountSchema, limit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  startsAt: z.iso.datetime().nullable(), endsAt: z.iso.datetime().nullable(), paused: z.boolean(),
  version: z.number().int().nonnegative(), reason: reasonSchema,
}).strict().refine(value => !value.startsAt || !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt), { message: "O término deve ser posterior ao início.", path: ["endsAt"] });
export const couponSchema = z.object({
  id: z.uuid(), code: couponCodeSchema, amount: couponAmountSchema, limit: z.number().int().positive().nullable(),
  startsAt: z.iso.datetime().nullable(), endsAt: z.iso.datetime().nullable(), paused: z.boolean(), version: z.number().int().nonnegative(),
  redeemed: z.number().int().nonnegative(), distributed: croinsSchema,
  status: z.enum(["Ativo", "Agendado", "Pausado", "Expirado", "Esgotado"]),
}).strict();
export type Coupon = z.infer<typeof couponSchema>;
export const couponsQuerySchema = z.object({ q: z.string().trim().max(80).default(""), status: z.enum(["Todos", "Ativo", "Agendado", "Pausado", "Expirado", "Esgotado"]).default("Todos"), offset: z.coerce.number().int().min(0).max(1000000).default(0), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
export const couponCountsSchema = z.object({ Todos: z.number().int().nonnegative(), Ativo: z.number().int().nonnegative(), Agendado: z.number().int().nonnegative(), Pausado: z.number().int().nonnegative(), Expirado: z.number().int().nonnegative(), Esgotado: z.number().int().nonnegative() }).strict();
export const couponsSchema = z.object({ items: z.array(couponSchema), hasMore: z.boolean(), total: z.number().int().nonnegative(), counts: couponCountsSchema }).strict();
export const redemptionsSchema = z.object({ items: z.array(z.object({ id: z.uuid(), username: z.string().nullable(), amount: couponAmountSchema, createdAt: z.iso.datetime() }).strict()), hasMore: z.boolean() }).strict();
export const couponDetailSchema = z.object({ coupon: couponSchema, redemptions: redemptionsSchema, audit: auditPageSchema }).strict();
export const redeemCouponSchema = z.object({ code: couponCodeSchema, requestId: z.uuid() }).strict();
export const resourceIdSchema = z.uuid();
export const commandResultSchema = z.object({ ok: z.literal(true) }).strict();
export const resourceResultSchema = z.object({ id: z.uuid() }).strict();

export * from "./games.js";
export * from "./markets.js";
export * from "./overview.js";
