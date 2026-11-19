import { resourceIdSchema } from "@croebet/shared";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { adminUserDetailSchema } from "@croebet/shared";
import { getInitialSession } from "@/features/auth/server-session";
import { getManagement } from "@/features/admin/server-management";
import { AdminUserDetail } from "@/features/admin/admin-users";
import { ManagementUnavailable } from "@/features/admin/management-shared";
import { AdminAccess } from "@/features/admin/admin-access";

export const metadata: Metadata = { title: "Detalhes do usuário · Admin · Croebet" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "minha-conta") {
    const session = await getInitialSession();
    if (!session.user || session.user.role !== "admin") notFound();
    redirect(`/admin/usuarios/${session.user.id}`);
  }
  if (!resourceIdSchema.safeParse(id).success) notFound();
  const data = await getManagement(`/admin/users/${id}`, adminUserDetailSchema);
  return <AdminAccess section="users" content={data ? <AdminUserDetail key={`${data.user.id}:${data.user.role}:${data.user.status}:${data.user.balance}:${data.audit.items[0]?.id}`} initial={data} /> : <ManagementUnavailable />} />;
}
