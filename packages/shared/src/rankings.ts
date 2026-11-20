import { z } from "zod";

export const rankingQuerySchema = z.object({
  category: z.enum(["wins", "richest", "losers"]).default("wins"),
  period: z.enum(["month", "all"]).default("month"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const rankingEntrySchema = z.object({
  userId: z.uuid(), username: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(),
  position: z.number().int().positive(), value: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  games: z.number().int().nonnegative(),
});
export const rankingSchema = z.object({
  category: rankingQuerySchema.shape.category, period: rankingQuerySchema.shape.period,
  page: z.number().int().positive(), hasMore: z.boolean(),
  items: z.array(rankingEntrySchema), own: rankingEntrySchema.nullable(),
});
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
export type Ranking = z.infer<typeof rankingSchema>;
