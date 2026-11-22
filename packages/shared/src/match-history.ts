import { z } from "zod";
import { flip7ViewSchema, matchEconomyFields, matchFrameSchema, matchCodeSchema,gameFrameSchema } from "./matches.js";
import {gameOptionsSchema,gameIdSchema,gameViewSchema} from "./game-registry.js";
export const matchHistoryQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).default(""),
  source: z.enum(["official", "development"]).default("official"),
  status: z.enum(["all", "playing", "finished", "abandoned"]).default("all"),
}).strict();
export const matchHistoryItemSchema = z.object({ ...matchEconomyFields,
  id: z.uuid(), code: matchCodeSchema, gameId: z.uuid(),game:gameIdSchema.optional(), rulesVersion: z.number().int().positive(),
  status: z.enum(["playing", "finished", "abandoned"]), options: gameOptionsSchema,
  development: z.boolean().default(false),
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
  activeDurationSeconds: z.number().int().nonnegative().nullable().default(null),
  startedAt: z.iso.datetime(), endedAt: z.iso.datetime().nullable(),
  players: z.array(z.object({ seat: z.number().int().min(0).max(11), userId: z.uuid().nullable(), name: z.string(), avatarUrl: z.string().nullable().default(null), score: z.number().int(), winner: z.boolean(), bot: z.boolean() }).strict()).max(12),
  frameCount: z.number().int().nonnegative(),
}).strict();
export const matchHistoryListSchema = z.object({ items: z.array(matchHistoryItemSchema), hasMore: z.boolean(), averages: z.array(z.object({game:gameIdSchema, options:gameOptionsSchema, players:z.number().int(), onlyBots:z.boolean(), count:z.number().int(), durationSeconds:z.number().nonnegative(), activeDurationSeconds:z.number().nonnegative().nullable()})).default([]) }).strict();
export const matchReplaySchema = z.object({ match: matchHistoryItemSchema, finalState: flip7ViewSchema.nullable().default(null), frames: z.array(matchFrameSchema), offset: z.number().int().nonnegative(), hasMore: z.boolean() }).strict();
export type MatchHistoryItem = z.infer<typeof matchHistoryItemSchema>;

export const gameReplaySchema=z.object({match:matchHistoryItemSchema,finalState:gameViewSchema.nullable().default(null),frames:z.array(gameFrameSchema),offset:z.number().int().nonnegative(),hasMore:z.boolean()}).strict();
