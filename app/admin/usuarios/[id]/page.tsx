import { AdminAccess } from "@/features/admin/admin-access";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminAccess section="users" userId={id} />;
}
