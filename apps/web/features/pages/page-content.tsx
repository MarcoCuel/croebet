import { RichTextContent } from "@/components/ui/rich-text-content";
import type { SitePageRecord } from "@croebet/shared";
export function PageContent({ page }: { page: SitePageRecord }) {
  const document = page.document.some(node => typeof node !== "string" && node.tag === "h1")
    ? page.document : [{ tag: "h1" as const, children: [page.title] }, ...page.document];
  return <article className="max-w-[40rem] pt-10"><RichTextContent document={document} /></article>;
}
