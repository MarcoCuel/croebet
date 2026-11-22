import { z } from "zod";
import { seoFieldsSchema } from "./seo.js";
import { normalizeSlug } from "./slug.js";

export const gameSlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens no endereço.");
export const gameImageSchema = z.string().trim().max(2048).refine(value => {
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Informe uma URL HTTPS ou um caminho de imagem válido.").nullable();
export const gameWriteSchema = z.object({
  slug: z.string().transform(normalizeSlug).pipe(gameSlugSchema).optional(),
  seo: seoFieldsSchema.default(() => seoFieldsSchema.parse({})),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean(),
  fallbackDurationMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  imageUrl: gameImageSchema,
  version: z.number().int().positive(),
}).strict();
export const gameCreateSchema = gameWriteSchema.omit({ version: true }).extend({ slug: z.string().transform(normalizeSlug).pipe(gameSlugSchema) }).strict();
export const gameDeleteSchema = z.object({ version: z.number().int().positive() }).strict();
export const gameSchema = gameWriteSchema.extend({ moduleId: z.string().optional(), id: z.uuid(), slug: gameSlugSchema, averageDurationSeconds: z.number().nonnegative().nullable().optional() }).strict();
export const gamesSchema = z.object({ items: z.array(gameSchema) }).strict();
export type GameRecord = z.infer<typeof gameSchema>;
