import { z } from "zod";
import { flip7OptionsSchema, matchFrameSchema, matchCodeSchema } from "./matches.js";
export const matchHistoryQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).default(""),
  status: z.enum(["all", "playing", "finished", "abandoned"]).default("all"),
}).strict();
export const matchHistoryItemSchema = z.object({
  id: z.uuid(), code: matchCodeSchema, gameId: z.uuid(), rulesVersion: z.number().int().positive(),
  status: z.enum(["playing", "finished", "abandoned"]), options: flip7OptionsSchema,
  startedAt: z.iso.datetime(), endedAt: z.iso.datetime().nullable(),
  players: z.array(z.object({ seat: z.number().int().min(0).max(11), userId: z.uuid().nullable(), name: z.string(), score: z.number().int(), winner: z.boolean(), bot: z.boolean() }).strict()).max(12),
  frameCount: z.number().int().nonnegative(),
}).strict();
export const matchHistoryListSchema = z.object({ items: z.array(matchHistoryItemSchema), hasMore: z.boolean() }).strict();
export const matchReplaySchema = z.object({ match: matchHistoryItemSchema, frames: z.array(matchFrameSchema), offset: z.number().int().nonnegative(), hasMore: z.boolean() }).strict();
export type MatchHistoryItem = z.infer<typeof matchHistoryItemSchema>;
