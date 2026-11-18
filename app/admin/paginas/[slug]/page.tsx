import { AdminAccess } from "@/features/admin/admin-access";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AdminAccess section="pages" pageSlug={slug} />;
}
