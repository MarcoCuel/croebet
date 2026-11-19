import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { PageContent } from "@/features/pages/page-content";
import { PageUnavailable } from "@/features/pages/page-unavailable";
import { loadPublicPage } from "@/features/pages/api";
const getPage = cache((slug: string) => loadPublicPage(process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001", slug));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const result = await getPage((await params).slug);
  return result.status === "ready" ? { title: result.page.title + " · Croebet" } : result.status === "not-found" ? { title: "Página não encontrada · Croebet" } : {};
}
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await getPage((await params).slug);
  if (result.status === "not-found") notFound();
  return <PageShell>{result.status === "ready" ? <PageContent page={result.page} /> : <PageUnavailable />}</PageShell>;
}
