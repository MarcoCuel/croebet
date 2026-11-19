import { resourceIdSchema } from "@croebet/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminUsersSchema, couponDetailSchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { AdminCouponEditor } from "@/features/admin/admin-coupons";
import { ManagementUnavailable } from "@/features/admin/management-shared";
import { AdminAccess } from "@/features/admin/admin-access";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id === "novo" ? "Novo cupom" : "Gerenciar cupom"} · Admin · Croebet` };
}

export default async function AdminCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "novo") {
    const authorized = await getManagement("/admin/users?limit=1", adminUsersSchema);
    return <AdminAccess section="coupons" content={authorized ? <AdminCouponEditor initial={null} /> : <ManagementUnavailable />} />;
  }
  if (!resourceIdSchema.safeParse(id).success) notFound();
  const data = await getManagement(`/admin/coupons/${id}`, couponDetailSchema);
  return <AdminAccess section="coupons" content={data ? <AdminCouponEditor key={`${id}:${data.coupon.version}:${data.coupon.redeemed}`} initial={data} /> : <ManagementUnavailable />} />;
}
