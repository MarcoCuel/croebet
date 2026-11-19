import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";
import { adminOverviewSchema, overviewQuerySchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { AdminOverview } from "@/features/admin/admin-overview";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export const metadata: Metadata = { title: "Visão geral · Admin · Croebet" };

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = overviewQuerySchema.safeParse({ days: (await searchParams).days });
  const days = query.success ? query.data.days : 7;
  const data = await getManagement(`/admin/overview?days=${days}`, adminOverviewSchema);
  return <AdminAccess content={data ? <AdminOverview data={data} /> : <ManagementUnavailable />} />;
}
