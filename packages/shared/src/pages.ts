import { z } from "zod";
import { isRichTextDocument, richTextPlainText } from "./rich-text.js";

const reserved = new Set(["admin", "api", "jogos", "apostas", "rankings", "conquistas", "historico", "perfil", "nova", "_next", "favicon", "robots", "sitemap"]);
export const pageSlugSchema = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(slug => !reserved.has(slug), "Este endereço é reservado.");
const documentSchema = z.custom<import("./rich-text.js").RichTextDocument>(isRichTextDocument, "Conteúdo inválido.")
  .refine(value => JSON.stringify(value).length <= 45000, "Conteúdo muito longo.");
const fields = {
  slug: pageSlugSchema, title: z.string().trim().min(1).max(100), document: documentSchema,
  published: z.boolean(), showInMenu: z.boolean(),
};
export const pageWriteSchema = z.object({ ...fields, version: z.number().int().min(0) }).strict()
  .refine(page => !page.published || richTextPlainText(page.document).trim().length > 0, "Escreva o conteúdo antes de publicar.");
export const sitePageSchema = z.object({ ...fields, id: z.uuid(), version: z.number().int().positive() }).strict();
export const pagesSchema = z.object({ items: z.array(sitePageSchema) }).strict();
export const pageLinksSchema = z.object({ items: z.array(z.object({ slug: pageSlugSchema, title: z.string(), showInMenu: z.boolean() }).strict()) }).strict();
export type SitePageRecord = z.infer<typeof sitePageSchema>;
export type PageLink = z.infer<typeof pageLinksSchema>["items"][number];
