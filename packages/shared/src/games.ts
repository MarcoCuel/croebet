import { z } from "zod";
import { seoFieldsSchema } from "./seo.js";

export const gameSlugSchema = z.enum(["flip7"]);
export const gameImageSchema = z.string().trim().max(2048).refine(value => {
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Informe uma URL HTTPS ou um caminho de imagem válido.").nullable();
export const gameWriteSchema = z.object({
  seo: seoFieldsSchema.default(() => seoFieldsSchema.parse({})),
  name: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  imageUrl: gameImageSchema,
  version: z.number().int().positive(),
}).strict();
export const gameSchema = gameWriteSchema.extend({ id: z.uuid(), slug: gameSlugSchema }).strict();
export const gamesSchema = z.object({ items: z.array(gameSchema) }).strict();
export type GameRecord = z.infer<typeof gameSchema>;
