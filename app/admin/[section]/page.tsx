import { notFound, redirect } from "next/navigation";
import { AdminAccess } from "@/features/admin/admin-access";
import { adminRoutes } from "@/features/admin/routes";

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "sobre") redirect("/admin/paginas/sobre");
  const entry = Object.entries(adminRoutes).find(
    ([, href]) => href === `/admin/${section}`,
  );
  if (!entry) notFound();
  return <AdminAccess section={entry[0] as keyof typeof adminRoutes} />;
}
