import { isRichTextDocument, richTextPlainText, type RichTextDocument } from "@/lib/rich-text";

export type SitePage = {
  slug: string;
  title: string;
  document: RichTextDocument;
  published: boolean;
  showInMenu?: boolean;
};

const reservedSlugs = new Set([
  "admin", "api", "jogos", "apostas", "rankings", "conquistas",
  "historico", "nova", "_next", "favicon", "robots", "sitemap",
]);

export function validPageSlug(slug: string) {
  return slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !reservedSlugs.has(slug);
}

export function isSitePage(value: unknown): value is SitePage {
  if (!value || typeof value !== "object") return false;
  const page = value as SitePage;
  return typeof page.slug === "string" && validPageSlug(page.slug) &&
    typeof page.title === "string" && page.title.trim().length > 0 && page.title.length <= 100 &&
    (page.showInMenu === undefined || typeof page.showInMenu === "boolean") &&
    typeof page.published === "boolean" && isRichTextDocument(page.document) &&
    (!page.published || richTextPlainText(page.document).trim().length > 0);
}

export const defaultPages: SitePage[] = [
  { slug: "termos", title: "Termos de uso", document: [], published: false },
  { slug: "privacidade", title: "Política de privacidade", document: [], published: false },
];
