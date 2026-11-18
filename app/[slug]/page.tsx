import { PageShell } from "@/components/layout/page-shell";
import { PageContent } from "@/features/pages/page-content";

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PageShell><PageContent slug={slug} /></PageShell>;
}
