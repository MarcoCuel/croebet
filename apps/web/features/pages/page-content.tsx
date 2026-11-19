import { RichTextContent } from "@/components/ui/rich-text-content";
import type { SitePageRecord } from "@croebet/shared";
export function PageContent({ page }: { page: SitePageRecord }) {
  const document = page.document.some(node => typeof node !== "string" && node.tag === "h1")
    ? page.document : [{ tag: "h1" as const, children: [page.title] }, ...page.document];
  return <article className="mx-auto max-w-[46rem]"><RichTextContent document={document} /></article>;
}
