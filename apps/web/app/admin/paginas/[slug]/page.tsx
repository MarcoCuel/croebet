import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";
import { sitePageSchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { getInitialSession } from "@/features/auth/server-session";
import { notFound } from "next/navigation";
import { AdminPageEditor } from "@/features/admin/admin-pages";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug === "nova" ? "Nova página" : "Editar página"} · Admin · Croebet` };
}

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getInitialSession();
  if (session.ready && session.user?.role !== "admin") notFound();
  if (!session.ready) return <AdminAccess section="pages" content={<ManagementUnavailable />} />;
  const page = slug === "nova" ? null : await getManagement(`/admin/pages/${encodeURIComponent(slug)}`, sitePageSchema);
  return <AdminAccess section="pages" content={slug !== "nova" && !page ? <ManagementUnavailable /> : <AdminPageEditor key={page ? `${page.id}:${page.version}` : "nova"} page={page} />} />;
}
