import { z } from "zod";
export const mediaMaxBytes = 10 * 1024 * 1024;
export const mediaContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const mediaItemSchema = z.object({
  id: z.uuid(), url: z.string().startsWith("/api/v1/media/"), name: z.string().max(160),
  width: z.number().int().positive(), height: z.number().int().positive(),
  bytes: z.number().int().positive(), createdAt: z.iso.datetime(),
});
export const mediaListSchema = z.object({ items: z.array(mediaItemSchema), hasMore: z.boolean() });
export const mediaQuerySchema = z.object({ q: z.string().trim().max(160).default(""), offset: z.coerce.number().int().min(0).max(1000000).default(0) });
export type MediaItem = z.infer<typeof mediaItemSchema>;
export const mediaDeleteResultSchema = z.object({ ok: z.literal(true) });
