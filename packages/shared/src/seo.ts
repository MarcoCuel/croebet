import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
export const seoImageSchema = text(2048).refine(value => {
  if (!value || /^\/(?!\/)[^\s\\]*$/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Informe uma URL HTTPS ou um caminho de imagem válido.");
export const seoFieldsSchema = z.object({ title: text(160).default(""), description: text(500).default(""), image: seoImageSchema.default(""), imageAlt: text(200).default(""), index: z.boolean().default(true) }).strict();
export type SeoFields = z.infer<typeof seoFieldsSchema>;
export const seoSettingsSchema = z.object({ siteName: text(80).min(1), title: text(160).min(1), description: text(500), titleTemplate: text(200).refine(value => value.includes("{título}"), "Inclua {título} no formato."), image: seoImageSchema, imageAlt: text(200), index: z.boolean(), home: seoFieldsSchema, games: seoFieldsSchema, version: z.number().int().nonnegative() }).strict();
export type SeoSettings = z.infer<typeof seoSettingsSchema>;
export const defaultSeoSettings: SeoSettings = { siteName: "Croebet", title: "Croebet — O meu também é Betty", description: "Jogos de sorte, previsões duvidosas e Croins em jogo.", titleTemplate: "{título} · Croebet", image: "", imageAlt: "", index: false, home: seoFieldsSchema.parse({}), games: seoFieldsSchema.parse({}), version: 0 };

export const seoPathsSchema = z.object({ paths: z.array(z.string().startsWith("/")) }).strict();
