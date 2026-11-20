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
// Bots remain available to engine tests, never to public room creation.
export const createMatchSchema = z.object({ requestId: z.uuid(), game: z.literal("flip7"), capacity: integer.min(2).max(12), options: flip7OptionsSchema, entryAmount: integer.min(0).default(0) }).strict();
export const lobbyCommandSchema = z.object({ commandId: z.uuid() }).strict();
export const updateLobbySchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), capacity: integer.min(2).max(12), options: flip7OptionsSchema, entryAmount: integer.min(0).default(0) }).strict();
export type UpdateLobby = z.infer<typeof updateLobbySchema>;
export const confirmEntrySchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), entryAmount: integer.positive() }).strict();
export type ConfirmEntry = z.infer<typeof confirmEntrySchema>;
export const matchPayoutSchema = z.object({ seat, amount: integer.min(0), house: z.boolean() }).strict();
export const matchEconomyFields = { entryAmount: integer.min(0).default(0), potTotal: integer.min(0).default(0), payouts: z.array(matchPayoutSchema).max(12).default([]), settlement: z.enum(["pending", "paid", "refunded"]).nullable().default(null) };
export const kickMatchSchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), targetUserId: z.uuid() }).strict();
export type KickMatch = z.infer<typeof kickMatchSchema>;
export const matchCommandSchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive(), action: flip7ActionSchema }).strict();
export const matchAbandonSchema = z.object({ commandId: z.uuid(), expectedVersion: integer.positive() }).strict();
export const matchCodeSchema = z.string().regex(/^[A-F0-9]{12}$/);
export const matchParticipantSchema = z.object({ userId: z.uuid(), username: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), seat: integer.min(0).max(11) }).strict();
const roomFields = { ...matchEconomyFields, id: z.uuid(), code: matchCodeSchema, game: z.literal("flip7"), rulesVersion: integer.positive(), version: integer.positive(), capacity: integer.min(2).max(12), options: flip7OptionsSchema, hostId: z.uuid(), participants: z.array(matchParticipantSchema).max(12) };
export const lobbySchema = z.object({ ...roomFields, status: z.literal("lobby"), state: z.null(), pendingInvitations: z.array(z.object({userId:z.uuid(),username:z.string(),avatarUrl:z.string().nullable()}).strict()).default([]), onlineUserIds:z.array(z.uuid()).default([]), confirmedUserIds:z.array(z.uuid()).default([]) }).strict();
export const matchSchema = z.object({ ...roomFields, durationSeconds: integer.min(0).nullable().default(null), status: z.enum(["playing", "finished", "abandoned"]), state: flip7ViewSchema }).strict();
export const roomSchema = z.discriminatedUnion("status", [lobbySchema, matchSchema]);
export const lobbyListSchema = z.object({ items: z.array(lobbySchema).max(100), joined: z.array(lobbySchema), owned: lobbySchema.nullable(), active: matchSchema.nullable() }).strict();
export type LobbyList = z.infer<typeof lobbyListSchema>;
export const matchSummarySchema = z.object({ ...roomFields, status: z.literal("playing"), round: integer.positive(), controllerIds: z.array(z.uuid()).max(12) }).strict();
export type MatchSummary = z.infer<typeof matchSummarySchema>;
export const matchListSchema = z.object({ items: z.array(matchSummarySchema).max(100) }).strict();
export const matchFrameSchema = z.object({ action: flip7EventActionSchema, state: flip7ViewSchema, version: integer.positive() }).strict();
export const matchResultSchema = z.object({ match: matchSchema, before: flip7ViewSchema, frames: z.array(matchFrameSchema) }).strict();
export type Flip7View = z.infer<typeof flip7ViewSchema>;
export type Match = z.infer<typeof matchSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
export type MatchFrame = z.infer<typeof matchFrameSchema>;
export type MatchCommand = z.infer<typeof matchCommandSchema>;
export type CreateMatch = z.infer<typeof createMatchSchema>;

export const roomSyncSchema = z.object({ room: roomSchema, frames: z.array(matchFrameSchema), reset: z.boolean() }).strict();
export const lobbyActionResultSchema = z.union([roomSchema, z.object({code:matchCodeSchema,status:z.literal("closed")}).strict()]);
export type Lobby = z.infer<typeof lobbySchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomSync = z.infer<typeof roomSyncSchema>;
export type MatchParticipant = z.infer<typeof matchParticipantSchema>;

// Lobby invitations expose only public account data and a short presence lease.
export const invitePlayerSchema = z.object({ targetUserId: z.uuid() }).strict();
export const lobbyPlayersQuerySchema = z.object({ q: z.string().trim().max(80).default("") }).strict();
export const lobbyPlayersSchema = z.object({ items: z.array(z.object({
  userId: z.uuid(), username: z.string(), avatarUrl: z.string().nullable(), online: z.boolean(), invited: z.boolean(),
}).strict()), hasMore: z.boolean() }).strict();
export const lobbyInvitationsSchema = z.object({ items: z.array(z.object({
  code: matchCodeSchema, username: z.string(), avatarUrl: z.string().nullable(),
}).strict()) }).strict();
export type LobbyPlayers = z.infer<typeof lobbyPlayersSchema>;
export type LobbyInvitations = z.infer<typeof lobbyInvitationsSchema>;
