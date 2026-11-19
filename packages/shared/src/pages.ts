import { z } from "zod";
import { seoFieldsSchema } from "./seo.js";
import { isRichTextDocument, richTextPlainText } from "./rich-text.js";

const reserved = new Set(["admin", "api", "jogos", "apostas", "rankings", "conquistas", "carteira", "perfil", "nova", "_next", "favicon", "robots", "sitemap"]);
export const pageSlugSchema = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(slug => !reserved.has(slug), "Este endereço é reservado.");
const documentSchema = z.custom<import("./rich-text.js").RichTextDocument>(isRichTextDocument, "Conteúdo inválido.")
  .refine(value => JSON.stringify(value).length <= 45000, "Conteúdo muito longo.");
const fields = {
  seo: seoFieldsSchema.default(() => seoFieldsSchema.parse({})),
  slug: pageSlugSchema, title: z.string().trim().min(1).max(100), document: documentSchema,
  published: z.boolean(), showInMenu: z.boolean(),
};
export const pageStatusSchema = z.enum(["draft", "pending", "private", "scheduled", "published", "trash"]);
export type PageStatus = z.infer<typeof pageStatusSchema>;
export const pageAuthorsSchema = z.object({ items: z.array(z.object({ id: z.uuid(), username: z.string(), displayName: z.string() }).strict()) }).strict();
export type PageAuthor = z.infer<typeof pageAuthorsSchema>["items"][number];
export const pageDeleteSchema = z.object({ version: z.number().int().positive() }).strict();
export const pageDeleteResultSchema = z.object({ ok: z.literal(true) }).strict();
export const pageWriteSchema = z.object({ ...fields, version: z.number().int().min(0), status: pageStatusSchema.optional(), publishAt: z.iso.datetime().nullable().optional(), authorId: z.uuid().nullable().optional() }).strict()
  .refine(page => !(["published", "scheduled"].includes(page.status ?? (page.published ? "published" : "draft"))) || richTextPlainText(page.document).trim().length > 0, "Escreva o conteúdo antes de publicar.")
  .refine(page => page.status !== "scheduled" || !!page.publishAt, "Escolha uma data futura para agendar a publicação.");
export const sitePageSchema = z.object({ ...fields, id: z.uuid(), version: z.number().int().positive(),
  status: pageStatusSchema, publishAt: z.iso.datetime().nullable(), authorId: z.uuid().nullable(), authorName: z.string().nullable(),
  createdAt: z.iso.datetime().nullable(), updatedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(), lastEditedBy: z.string().nullable(),
}).strict();
export const pagesSchema = z.object({ items: z.array(sitePageSchema) }).strict();
export const pageLinksSchema = z.object({ items: z.array(z.object({ slug: pageSlugSchema, title: z.string(), showInMenu: z.boolean() }).strict()) }).strict();
export type SitePageRecord = z.infer<typeof sitePageSchema>;
export type PageLink = z.infer<typeof pageLinksSchema>["items"][number];
