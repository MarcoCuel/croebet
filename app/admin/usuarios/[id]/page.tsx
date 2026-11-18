import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";

export const metadata: Metadata = { title: "Detalhes do usuário · Admin · Croebet" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminAccess section="users" userId={id} />;
}
