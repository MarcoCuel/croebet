import { catalogMarketSchema, resourceIdSchema } from "@croebet/shared";
import { notFound } from "next/navigation";
import { getManagement } from "@/features/admin/server-management";
import { ManagementUnavailable } from "@/features/admin/management-shared";
import { AdminMarketCatalogEditor } from "@/features/admin/admin-market-catalog-editor";
import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id === "nova" ? "Nova aposta" : "Editar aposta"} · Admin · Croebet` };
}

export default async function AdminMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "nova") return <AdminAccess section="markets" content={<AdminMarketCatalogEditor />} />;
  if (!resourceIdSchema.safeParse(id).success) notFound();
  const market = await getManagement(`/admin/markets/${id}`, catalogMarketSchema);
  return <AdminAccess section="markets" content={market ? <AdminMarketCatalogEditor key={`${market.id}:${market.version}`} market={market} /> : <ManagementUnavailable />} />;
}
