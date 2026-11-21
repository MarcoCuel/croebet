import { z } from "zod";

export const chatCursorSchema = z.string().regex(/^(0|[1-9]\d{0,18})$/).refine(value => value.length <= 19 && /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n, "Cursor inválido.");
export const chatSendSchema = z.object({ requestId: z.uuid(), text: z.string().trim().min(1, "Escreva uma mensagem.").max(500, "Use até 500 caracteres.") }).strict();
export const chatReceiptSchema = z.object({ id: chatCursorSchema }).strict();
export const chatMuteSchema = z.object({ minutes: z.union([z.literal(0), z.literal(10), z.literal(60), z.literal(1440)]) }).strict();
export const chatPageQuerySchema = z.object({ before: chatCursorSchema.optional() }).strict();
export const chatSyncQuerySchema = z.object({ after: chatCursorSchema }).strict();
export const chatMessageSchema = z.object({
  id: chatCursorSchema, userId: z.uuid().nullable(), username: z.string().nullable(), name: z.string(), avatarUrl: z.string().nullable(),
  text: z.string().nullable(), createdAt: z.iso.datetime(), deleted: z.boolean(),
}).strict();
export const chatPageSchema = z.object({ items: z.array(chatMessageSchema), hasMore: z.boolean(), cursor: chatCursorSchema, mutedUntil: z.iso.datetime().nullable() }).strict();
export const chatSyncSchema = z.object({ events: z.array(z.object({ id: chatCursorSchema, message: chatMessageSchema.nullable(), kind: z.enum(["message", "delete", "mute"]) }).strict()), cursor: chatCursorSchema, hasMore: z.boolean(), mutedUntil: z.iso.datetime().nullable() }).strict();
export type ChatMessage = z.infer<typeof chatMessageSchema>;
