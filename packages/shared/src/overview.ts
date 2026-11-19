import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amount = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
export const overviewDaysSchema = z.union([z.literal(1), z.literal(7), z.literal(30)]);
export const overviewQuerySchema = z.object({
  days: z.union([z.string(), z.number()]).pipe(z.coerce.number()).pipe(overviewDaysSchema).default(7),
}).strict();
export const adminOverviewSchema = z.object({
  days: overviewDaysSchema,
  generatedAt: z.iso.datetime(),
  totals: z.object({ users: count, activeUsers: count, movements: count, balance: count }).strict(),
  rewards: z.object({ dailyClaims: count, couponRedemptions: count }).strict(),
  circulation: z.object({ registration: count, daily: count, coupons: count, adjustments: amount, credits: count, debits: count }).strict(),
  buckets: z.array(z.object({ day: z.iso.date(), movements: count, credits: count, debits: count }).strict()).min(1).max(30),
  recentUsers: z.array(z.object({ id: z.uuid(), username: z.string(), createdAt: z.iso.datetime() }).strict()).max(5),
  transactions: z.array(z.object({
    id: z.uuid(), userId: z.uuid().nullable(), username: z.string().nullable(),
    description: z.string(), amount, createdAt: z.iso.datetime(),
  }).strict()).max(8),
}).strict().refine(value => value.buckets.length === value.days, { message: "Período incompleto." });
export type AdminOverviewData = z.infer<typeof adminOverviewSchema>;
