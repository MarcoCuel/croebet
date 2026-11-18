import { AdminAccess } from "@/features/admin/admin-access";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AdminAccess section="games" gameSlug={slug} />;
}
