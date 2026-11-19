import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";
import { sitePageSchema, pageAuthorsSchema, resourceIdSchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { getInitialSession } from "@/features/auth/server-session";
import { notFound } from "next/navigation";
import { AdminPageEditor } from "@/features/admin/admin-pages";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id === "nova" ? "Nova página" : "Editar página"} · Admin · Croebet` };
}

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "nova" && !resourceIdSchema.safeParse(id).success) notFound();
  const session = await getInitialSession();
  if (session.ready && session.user?.role !== "admin") notFound();
  if (!session.ready) return <AdminAccess section="pages" content={<ManagementUnavailable />} />;
  const [page, authors] = await Promise.all([
    id === "nova" ? null : getManagement(`/admin/pages/${encodeURIComponent(id)}`, sitePageSchema),
    getManagement("/admin/page-authors", pageAuthorsSchema),
  ]);
  return <AdminAccess section="pages" content={(id !== "nova" && !page) || !authors || !session.user ? <ManagementUnavailable /> : <AdminPageEditor key={page ? `${page.id}:${page.version}` : "nova"} page={page} authors={authors.items} currentAuthor={session.user} />} />;
}
