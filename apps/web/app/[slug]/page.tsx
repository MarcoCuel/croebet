import { PageShell } from "@/components/layout/page-shell";
import { PageContent } from "@/features/pages/page-content";
import { initialSiteConfig } from "@/features/admin/site-storage";

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initialPage = initialSiteConfig.pages.find((page) => page.slug === slug && page.published) ?? null;
  return <PageShell><PageContent slug={slug} initialPage={initialPage} /></PageShell>;
}
