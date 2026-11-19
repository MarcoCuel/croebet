import { z } from "zod";

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
  dailyCooldownHours: z.number().int().positive(),
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
