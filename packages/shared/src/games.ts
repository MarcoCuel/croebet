import { z } from "zod";
import { seoFieldsSchema } from "./seo.js";

export const gameSlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens no endereço.");
export const gameImageSchema = z.string().trim().max(2048).refine(value => {
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Informe uma URL HTTPS ou um caminho de imagem válido.").nullable();
export const gameWriteSchema = z.object({
  seo: seoFieldsSchema.default(() => seoFieldsSchema.parse({})),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean(),
  imageUrl: gameImageSchema,
  version: z.number().int().positive(),
}).strict();
export const gameCreateSchema = gameWriteSchema.omit({ version: true }).extend({ slug: gameSlugSchema }).strict();
export const gameSchema = gameWriteSchema.extend({ id: z.uuid(), slug: gameSlugSchema }).strict();
export const gamesSchema = z.object({ items: z.array(gameSchema) }).strict();
export type GameRecord = z.infer<typeof gameSchema>;
