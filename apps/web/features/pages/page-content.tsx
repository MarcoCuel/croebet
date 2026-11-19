"use client";

import { notFound } from "next/navigation";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { useSiteConfig } from "@/features/admin/site-config";
import type { SitePage } from "@/features/pages/content";

export function PageContent({ slug, initialPage }: { slug: string; initialPage: SitePage | null }) {
  const { config, ready, error } = useSiteConfig();
  if (!ready && !initialPage) return <p role="status">Carregando página…</p>;
  if (error) return <p role="alert">{error}</p>;
  const page = ready ? config.pages.find((p) => p.slug === slug && p.published) : initialPage;
  if (!page) notFound();
  const document = page.document.some(
    (node) => typeof node !== "string" && node.tag === "h1",
  )
    ? page.document
    : [{ tag: "h1" as const, children: [page.title] }, ...page.document];

  return (
    <article className="mx-auto max-w-[46rem]">
      <title>{`${page.title} · Croebet`}</title>
      <RichTextContent document={document} />
    </article>
  );
}
