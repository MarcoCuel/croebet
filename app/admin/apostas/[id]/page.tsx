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
  return <AdminAccess section="markets" marketId={id} />;
}
