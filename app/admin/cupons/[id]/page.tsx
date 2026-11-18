import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id === "novo" ? "Novo cupom" : "Gerenciar cupom"} · Admin · Croebet` };
}

export default async function AdminCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminAccess section="coupons" couponId={id} />;
}
