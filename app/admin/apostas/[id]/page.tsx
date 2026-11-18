import { AdminAccess } from "@/features/admin/admin-access";

export default async function AdminMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminAccess section="markets" marketId={id} />;
}
