import { z } from "zod";
const integer = z.number().int().safe();
const seat = integer.min(0).max(11);
export const flip7OptionsSchema = z.object({ mode: z.enum(["classic", "vengeance"]), brutal: z.boolean() }).strict()
  .refine(value => value.mode === "vengeance" || !value.brutal, "Brutal só está disponível no Vingança.");
export const flip7SetupSchema = z.object({ name: z.string().trim().min(1).max(24).regex(/^[^\u0000-\u001f\u007f]+$/u), kind: z.enum(["human", "easy", "normal", "hard"]) }).strict();
export const flip7CardSchema = z.object({ id: integer.min(0).max(107), type: z.enum(["number", "bonus", "double", "chance", "freeze", "three", "zero", "unlucky7", "lucky13", "minus", "halve", "one", "four", "steal", "swap", "remove"]), value: integer.min(0).max(13) }).strict();
const pending = z.object({ source: seat, card: flip7CardSchema, give: z.boolean().optional(), resolving: z.boolean().optional() }).strict();
export const flip7ViewSchema = z.object({
  mode: z.enum(["classic", "vengeance"]), brutal: z.boolean(),
  players: z.array(flip7SetupSchema.extend({ cards: z.array(flip7CardSchema).max(108), total: integer, hasDrawn: z.boolean(), status: z.enum(["playing", "stayed", "frozen", "busted"]), bustedCards: z.array(integer.min(0)).optional() })).min(2).max(12),
  deckCount: integer.min(0).max(108), discard: z.array(flip7CardSchema).max(108), turn: seat, round: integer.positive(),
  phase: z.enum(["playing", "summary", "over"]), pending: pending.nullable(), queue: z.array(pending).max(108),
  forced: z.object({ target: seat, remaining: integer.min(1).max(4), queueStart: integer.min(0).optional(), stopAfter: z.boolean().optional() }).strict().nullable(),
  history: z.array(z.array(integer).min(2).max(12)),
  log: z.array(z.object({ message: z.string(), player: seat.optional(), card: flip7CardSchema.optional() }).strict()),
  flip7: seat.nullable(), lastDraw: flip7CardSchema.nullable(), bonusChoice: seat.nullable().optional(), bonusTarget: seat.nullable().optional(),
}).strict();
export const flip7ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draw") }).strict(), z.object({ type: z.literal("stay") }).strict(),
  z.object({ type: z.literal("target"), target: seat }).strict(),
  z.object({ type: z.literal("cards"), cards: z.array(integer.min(0).max(107)).min(1).max(2).refine(ids => new Set(ids).size === ids.length) }).strict(),
  z.object({ type: z.literal("bonus"), target: seat.nullable() }).strict(),
]);
export const flip7EventActionSchema = z.union([flip7ActionSchema, z.object({ type: z.literal("step") }).strict(), z.object({ type: z.literal("next") }).strict(), z.object({ type: z.literal("start") }).strict(), z.object({ type: z.literal("replace"), seat }).strict()]);
