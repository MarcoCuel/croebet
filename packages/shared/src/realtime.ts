import { z } from "zod";
import { confirmEntrySchema, createMatchSchema, invitePlayerSchema, kickMatchSchema, lobbyCommandSchema, matchAbandonSchema, matchCodeSchema, gameCommandSchema, updateLobbySchema } from "./matches.js";

const code = { code: matchCodeSchema };
export const matchWatchSchema = z.object({ code: matchCodeSchema.optional(), active: z.boolean().default(true), directory: z.boolean().default(true), afterVersion: z.number().int().nonnegative().default(0) }).strict();
export const realtimeRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), input: createMatchSchema }).strict(),
  ...(["join", "leave"] as const).map(type => z.object({ type: z.literal(type), ...code, input: lobbyCommandSchema }).strict()),
  z.object({ type: z.literal("confirm-entry"), ...code, input: confirmEntrySchema }).strict(),
  z.object({ type: z.literal("start"), ...code, input: matchAbandonSchema }).strict(),
  z.object({ type: z.literal("update"), ...code, input: updateLobbySchema }).strict(),
  z.object({ type: z.literal("kick"), ...code, input: kickMatchSchema }).strict(),
  z.object({ type: z.literal("command"), ...code, input: gameCommandSchema }).strict(),
  z.object({ type: z.literal("abandon"), ...code, input: matchAbandonSchema }).strict(),
  z.object({ type: z.literal("invite"), ...code, input: invitePlayerSchema }).strict(),
  z.object({ type: z.literal("decline"), ...code }).strict(),
  z.object({ type: z.literal("presence") }).strict(),
]);
export const realtimeReplySchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }).strict() }).strict(),
]);
export type RealtimeRequest = z.infer<typeof realtimeRequestSchema>;
export type RealtimeReply = z.infer<typeof realtimeReplySchema>;
